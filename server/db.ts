/**
 * SQLite persistence (Node experimental node:sqlite).
 * Data lives in server/data/airline-tycoon.db
 */

import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DatabaseSync } from 'node:sqlite'

const __dirname = dirname(fileURLToPath(import.meta.url))
/**
 * Local: server/data/
 * Vercel: /tmp (ephemeral — cloud saves may reset on cold starts / new instances).
 * For durable production cloud, move to Postgres/Turso later.
 */
const dataDir =
  process.env.SQLITE_PATH
    ? dirname(process.env.SQLITE_PATH)
    : process.env.VERCEL
      ? join('/tmp', 'airline-tycoon')
      : join(__dirname, 'data')
const dbPath =
  process.env.SQLITE_PATH ?? join(dataDir, 'airline-tycoon.db')

mkdirSync(dataDir, { recursive: true })

export const db = new DatabaseSync(dbPath)

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY NOT NULL,
    username TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    is_admin INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS game_saves (
    user_id TEXT PRIMARY KEY NOT NULL,
    state_json TEXT NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS leaderboard (
    user_id TEXT PRIMARY KEY NOT NULL,
    username TEXT NOT NULL,
    cash REAL NOT NULL,
    reputation REAL NOT NULL,
    fleet INTEGER NOT NULL,
    routes INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS pending_cash_grants (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL,
    amount REAL NOT NULL,
    note TEXT,
    granted_by TEXT,
    created_at INTEGER NOT NULL,
    applied_at INTEGER,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_pending_grants_user
    ON pending_cash_grants(user_id, applied_at);
`)

// Migrate older DBs that predate is_admin
try {
  db.exec(`ALTER TABLE users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0`)
} catch {
  /* column already exists */
}

export type LbRow = {
  user_id: string
  username: string
  cash: number
  reputation: number
  fleet: number
  routes: number
  updated_at: number
}

export function upsertLeaderboard(
  userId: string,
  username: string,
  cash: number,
  reputation: number,
  fleet: number,
  routes: number,
): void {
  const updatedAt = Date.now()
  db.prepare(
    `INSERT INTO leaderboard (user_id, username, cash, reputation, fleet, routes, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET
       username = excluded.username,
       cash = excluded.cash,
       reputation = excluded.reputation,
       fleet = excluded.fleet,
       routes = excluded.routes,
       updated_at = excluded.updated_at`,
  ).run(userId, username, cash, reputation, fleet, routes, updatedAt)
}

export function topLeaderboard(limit = 20): LbRow[] {
  return db
    .prepare(
      `SELECT user_id, username, cash, reputation, fleet, routes, updated_at
       FROM leaderboard
       ORDER BY cash DESC
       LIMIT ?`,
    )
    .all(limit) as LbRow[]
}

export type DbUser = {
  id: string
  username: string
  password_hash: string
  created_at: number
  is_admin: number
}

export type PlayerSummary = {
  id: string
  username: string
  isAdmin: boolean
  createdAt: number
  saveUpdatedAt: number | null
  airlineName: string | null
  hubId: string | null
  cash: number | null
  reputation: number | null
  fleet: number | null
  routes: number | null
  setupComplete: boolean | null
  /** Unapplied admin cash gifts (applied on next cloud pull/push). */
  pendingCash: number
}

export type CashGrant = {
  id: string
  user_id: string
  amount: number
  note: string | null
  granted_by: string | null
  created_at: number
  applied_at: number | null
}

export type DbSave = {
  user_id: string
  state_json: string
  updated_at: number
}

function mapUser(row: DbUser | undefined): DbUser | undefined {
  if (!row) return undefined
  return {
    ...row,
    is_admin: Number(row.is_admin) ? 1 : 0,
  }
}

export function findUserByUsername(username: string): DbUser | undefined {
  const row = db
    .prepare(
      'SELECT id, username, password_hash, created_at, is_admin FROM users WHERE username = ? COLLATE NOCASE',
    )
    .get(username.trim()) as DbUser | undefined
  return mapUser(row)
}

export function findUserById(id: string): DbUser | undefined {
  const row = db
    .prepare(
      'SELECT id, username, password_hash, created_at, is_admin FROM users WHERE id = ?',
    )
    .get(id) as DbUser | undefined
  return mapUser(row)
}

export function createUser(
  id: string,
  username: string,
  passwordHash: string,
  isAdmin = false,
): DbUser {
  const createdAt = Date.now()
  db.prepare(
    'INSERT INTO users (id, username, password_hash, created_at, is_admin) VALUES (?, ?, ?, ?, ?)',
  ).run(id, username.trim(), passwordHash, createdAt, isAdmin ? 1 : 0)
  return {
    id,
    username: username.trim(),
    password_hash: passwordHash,
    created_at: createdAt,
    is_admin: isAdmin ? 1 : 0,
  }
}

export function setUserAdmin(userId: string, isAdmin: boolean): void {
  db.prepare('UPDATE users SET is_admin = ? WHERE id = ?').run(
    isAdmin ? 1 : 0,
    userId,
  )
}

export function setUserPasswordHash(userId: string, passwordHash: string): void {
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(
    passwordHash,
    userId,
  )
}

export function isUserAdmin(user: DbUser | undefined | null): boolean {
  return !!user && Number(user.is_admin) === 1
}

/** Lightweight player list for admin console (parses save JSON for stats). */
export function listPlayers(): PlayerSummary[] {
  const rows = db
    .prepare(
      `SELECT u.id, u.username, u.created_at, u.is_admin,
              s.updated_at AS save_updated_at, s.state_json,
              COALESCE((
                SELECT SUM(g.amount) FROM pending_cash_grants g
                WHERE g.user_id = u.id
              ), 0) AS total_granted
       FROM users u
       LEFT JOIN game_saves s ON s.user_id = u.id
       ORDER BY COALESCE(s.updated_at, 0) DESC, u.created_at DESC`,
    )
    .all() as Array<{
    id: string
    username: string
    created_at: number
    is_admin: number
    save_updated_at: number | null
    state_json: string | null
    total_granted: number
  }>

  return rows.map((r) => {
    let airlineName: string | null = null
    let hubId: string | null = null
    let cash: number | null = null
    let reputation: number | null = null
    let fleet: number | null = null
    let routes: number | null = null
    let setupComplete: boolean | null = null
    let adminCashReceived = 0

    if (r.state_json) {
      try {
        const st = JSON.parse(r.state_json) as {
          branding?: { name?: string }
          hubId?: string | null
          cash?: number
          reputation?: number
          ownedAircraft?: unknown[]
          routes?: unknown[]
          setupComplete?: boolean
          adminCashReceived?: number
        }
        airlineName = st.branding?.name?.trim() || null
        hubId = st.hubId ?? null
        cash = typeof st.cash === 'number' ? st.cash : null
        reputation =
          typeof st.reputation === 'number' ? st.reputation : null
        fleet = Array.isArray(st.ownedAircraft) ? st.ownedAircraft.length : null
        routes = Array.isArray(st.routes) ? st.routes.length : null
        setupComplete =
          typeof st.setupComplete === 'boolean' ? st.setupComplete : null
        adminCashReceived = Number(st.adminCashReceived ?? 0) || 0
      } catch {
        /* corrupt save — leave nulls */
      }
    }

    const totalGranted = Number(r.total_granted) || 0
    const pendingCash = totalGranted - adminCashReceived

    return {
      id: r.id,
      username: r.username,
      isAdmin: Number(r.is_admin) === 1,
      createdAt: r.created_at,
      saveUpdatedAt: r.save_updated_at,
      airlineName,
      hubId,
      cash,
      reputation,
      fleet,
      routes,
      setupComplete,
      pendingCash,
    }
  })
}

export function countUsers(): number {
  const row = db.prepare('SELECT COUNT(*) AS n FROM users').get() as {
    n: number
  }
  return Number(row?.n ?? 0)
}

export function createCashGrant(
  id: string,
  userId: string,
  amount: number,
  note: string | null,
  grantedBy: string | null,
): CashGrant {
  const createdAt = Date.now()
  db.prepare(
    `INSERT INTO pending_cash_grants
      (id, user_id, amount, note, granted_by, created_at, applied_at)
     VALUES (?, ?, ?, ?, ?, ?, NULL)`,
  ).run(id, userId, amount, note, grantedBy, createdAt)
  return {
    id,
    user_id: userId,
    amount,
    note,
    granted_by: grantedBy,
    created_at: createdAt,
    applied_at: null,
  }
}

/** Lifetime sum of all admin cash gifts for this user (never discarded). */
export function totalCashGranted(userId: string): number {
  const row = db
    .prepare(
      `SELECT COALESCE(SUM(amount), 0) AS n FROM pending_cash_grants
       WHERE user_id = ?`,
    )
    .get(userId) as { n: number }
  return Number(row?.n ?? 0)
}

export function listAllGrants(userId: string): CashGrant[] {
  return db
    .prepare(
      `SELECT id, user_id, amount, note, granted_by, created_at, applied_at
       FROM pending_cash_grants
       WHERE user_id = ?
       ORDER BY created_at ASC`,
    )
    .all(userId) as CashGrant[]
}

/**
 * Idempotent admin cash apply.
 *
 * Tracks how much gift total the save already absorbed via `adminCashReceived`.
 * delta = sum(all grants) - adminCashReceived → add to cash.
 * Survives client overwriting cash: next sync re-applies any missing delta.
 */
export function applyPendingCashGrants(
  userId: string,
  state: Record<string, unknown>,
): { state: Record<string, unknown>; granted: number; notes: string[] } {
  const total = totalCashGranted(userId)
  const received = Number(state.adminCashReceived ?? 0)
  const delta = total - received

  if (!Number.isFinite(delta) || delta === 0) {
    // Still stamp the counter so future loads are stable
    if (total > 0 && received !== total) {
      return {
        state: { ...state, adminCashReceived: total },
        granted: 0,
        notes: [],
      }
    }
    return { state, granted: 0, notes: [] }
  }

  const cash = Number(state.cash ?? 0) + delta
  const peakCash = Math.max(Number(state.peakCash ?? 0), cash)
  const now = Date.now()

  const financeLog = Array.isArray(state.financeLog)
    ? [...(state.financeLog as unknown[])]
    : []
  financeLog.unshift({
    id: crypto.randomUUID(),
    at: now,
    kind: 'other',
    label:
      delta >= 0
        ? `Admin gift +$${Math.round(delta).toLocaleString()}`
        : `Admin fine −$${Math.round(Math.abs(delta)).toLocaleString()}`,
    amount: delta,
  })

  const notifications = Array.isArray(state.notifications)
    ? [...(state.notifications as unknown[])]
    : []
  notifications.unshift({
    id: crypto.randomUUID(),
    at: now,
    tone: delta >= 0 ? 'good' : 'warn',
    text:
      delta >= 0
        ? `Admin gift +$${Math.round(delta).toLocaleString()}`
        : `Admin fine −$${Math.round(Math.abs(delta)).toLocaleString()}`,
  })

  // Mark rows applied for admin UI bookkeeping (optional; ledger still uses SUM)
  db.prepare(
    `UPDATE pending_cash_grants SET applied_at = ?
     WHERE user_id = ? AND applied_at IS NULL`,
  ).run(now, userId)

  return {
    state: {
      ...state,
      cash,
      peakCash,
      adminCashReceived: total,
      financeLog: financeLog.slice(0, 80),
      notifications: notifications.slice(0, 40),
    },
    granted: delta,
    notes: [
      delta >= 0
        ? `Admin gift +$${Math.round(delta).toLocaleString()}`
        : `Admin fine −$${Math.round(Math.abs(delta)).toLocaleString()}`,
    ],
  }
}

export function getSave(userId: string): DbSave | undefined {
  return db
    .prepare(
      'SELECT user_id, state_json, updated_at FROM game_saves WHERE user_id = ?',
    )
    .get(userId) as DbSave | undefined
}

export function upsertSave(userId: string, stateJson: string): number {
  const updatedAt = Date.now()
  db.prepare(
    `INSERT INTO game_saves (user_id, state_json, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET
       state_json = excluded.state_json,
       updated_at = excluded.updated_at`,
  ).run(userId, stateJson, updatedAt)
  return updatedAt
}

export function deleteSave(userId: string): void {
  db.prepare('DELETE FROM game_saves WHERE user_id = ?').run(userId)
}
