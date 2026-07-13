/**
 * SQLite persistence (Node experimental node:sqlite).
 * Data lives in server/data/airline-tycoon.db
 */

import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DatabaseSync } from 'node:sqlite'

const __dirname = dirname(fileURLToPath(import.meta.url))
const dataDir = join(__dirname, 'data')
const dbPath = join(dataDir, 'airline-tycoon.db')

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
              s.updated_at AS save_updated_at, s.state_json
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
  }>

  return rows.map((r) => {
    let airlineName: string | null = null
    let hubId: string | null = null
    let cash: number | null = null
    let reputation: number | null = null
    let fleet: number | null = null
    let routes: number | null = null
    let setupComplete: boolean | null = null

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
      } catch {
        /* corrupt save — leave nulls */
      }
    }

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
    }
  })
}

export function countUsers(): number {
  const row = db.prepare('SELECT COUNT(*) AS n FROM users').get() as {
    n: number
  }
  return Number(row?.n ?? 0)
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
