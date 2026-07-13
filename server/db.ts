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
    created_at INTEGER NOT NULL
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
}

export type DbSave = {
  user_id: string
  state_json: string
  updated_at: number
}

export function findUserByUsername(username: string): DbUser | undefined {
  const row = db
    .prepare(
      'SELECT id, username, password_hash, created_at FROM users WHERE username = ? COLLATE NOCASE',
    )
    .get(username.trim()) as DbUser | undefined
  return row
}

export function findUserById(id: string): DbUser | undefined {
  const row = db
    .prepare(
      'SELECT id, username, password_hash, created_at FROM users WHERE id = ?',
    )
    .get(id) as DbUser | undefined
  return row
}

export function createUser(
  id: string,
  username: string,
  passwordHash: string,
): DbUser {
  const createdAt = Date.now()
  db.prepare(
    'INSERT INTO users (id, username, password_hash, created_at) VALUES (?, ?, ?, ?)',
  ).run(id, username.trim(), passwordHash, createdAt)
  return {
    id,
    username: username.trim(),
    password_hash: passwordHash,
    created_at: createdAt,
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
