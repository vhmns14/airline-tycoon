/**
 * Airline Tycoon API — auth + cloud game saves (SQLite) + admin players list.
 *
 * Run: npx tsx --experimental-sqlite server/index.ts
 * Env: PORT (default 3001), JWT_SECRET, ADMIN_USERNAME, ADMIN_PASSWORD
 */

import cors from 'cors'
import express from 'express'
import { randomUUID } from 'node:crypto'
import {
  createUser,
  deleteSave,
  findUserById,
  findUserByUsername,
  getSave,
  countUsers,
  isUserAdmin,
  listPlayers,
  setUserAdmin,
  setUserPasswordHash,
  topLeaderboard,
  upsertLeaderboard,
  upsertSave,
} from './db.ts'
import {
  hashPassword,
  signToken,
  validateCredentials,
  verifyPassword,
  verifyToken,
} from './auth.ts'

const PORT = Number(process.env.PORT ?? 3001)
const app = express()

app.use(cors({ origin: true, credentials: true }))
app.use(express.json({ limit: '4mb' }))

type AuthedRequest = express.Request & {
  userId?: string
  username?: string
  isAdmin?: boolean
}

function publicUser(user: {
  id: string
  username: string
  is_admin?: number
}) {
  return {
    id: user.id,
    username: user.username,
    isAdmin: isUserAdmin(user as { is_admin: number }),
  }
}

/** Ensure env admin account exists (or promote + refresh password). */
async function bootstrapAdmin(): Promise<void> {
  const username = process.env.ADMIN_USERNAME?.trim()
  const password = process.env.ADMIN_PASSWORD
  if (!username || !password) {
    console.log(
      'Admin: set ADMIN_USERNAME + ADMIN_PASSWORD to create/promote admin account',
    )
    return
  }
  if (password.length < 6) {
    console.warn('Admin: ADMIN_PASSWORD must be at least 6 characters — skipped')
    return
  }
  const existing = findUserByUsername(username)
  if (existing) {
    setUserAdmin(existing.id, true)
    const hash = await hashPassword(password)
    setUserPasswordHash(existing.id, hash)
    console.log(`Admin: promoted @${existing.username}`)
    return
  }
  const id = randomUUID()
  const hash = await hashPassword(password)
  createUser(id, username, hash, true)
  console.log(`Admin: created @${username}`)
}

async function requireAuth(
  req: AuthedRequest,
  res: express.Response,
  next: express.NextFunction,
) {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Login required.' })
    return
  }
  const token = header.slice(7)
  const payload = await verifyToken(token)
  if (!payload) {
    res.status(401).json({ error: 'Session expired. Please log in again.' })
    return
  }
  const user = findUserById(payload.sub)
  if (!user) {
    res.status(401).json({ error: 'Account not found.' })
    return
  }
  req.userId = user.id
  req.username = user.username
  req.isAdmin = isUserAdmin(user)
  next()
}

function requireAdmin(
  req: AuthedRequest,
  res: express.Response,
  next: express.NextFunction,
) {
  if (!req.isAdmin) {
    res.status(403).json({ error: 'Admin only.' })
    return
  }
  next()
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'airline-tycoon-api' })
})

app.post('/api/auth/register', async (req, res) => {
  const { username, password } = req.body ?? {}
  const err = validateCredentials(username, password)
  if (err) {
    res.status(400).json({ error: err })
    return
  }
  if (findUserByUsername(username)) {
    res.status(409).json({ error: 'Username already taken.' })
    return
  }
  const id = randomUUID()
  const passwordHash = await hashPassword(password)
  // First-ever account becomes admin if no env admin configured
  const adminUser = process.env.ADMIN_USERNAME?.trim()
  const makeAdmin = !adminUser && listPlayers().length === 0
  const user = createUser(id, username, passwordHash, makeAdmin)
  const token = await signToken({ sub: user.id, username: user.username })
  res.status(201).json({
    token,
    user: publicUser(user),
  })
})

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body ?? {}
  const err = validateCredentials(username, password)
  if (err) {
    res.status(400).json({ error: err })
    return
  }
  const user = findUserByUsername(username)
  if (!user || !(await verifyPassword(password, user.password_hash))) {
    res.status(401).json({ error: 'Invalid username or password.' })
    return
  }
  const token = await signToken({ sub: user.id, username: user.username })
  res.json({
    token,
    user: publicUser(user),
  })
})

app.get('/api/auth/me', requireAuth, (req: AuthedRequest, res) => {
  const user = findUserById(req.userId!)
  if (!user) {
    res.status(401).json({ error: 'Account not found.' })
    return
  }
  res.json({ user: publicUser(user) })
})

app.get('/api/save', requireAuth, (req: AuthedRequest, res) => {
  const save = getSave(req.userId!)
  if (!save) {
    res.json({ save: null })
    return
  }
  try {
    const state = JSON.parse(save.state_json)
    res.json({
      save: {
        state,
        updatedAt: save.updated_at,
      },
    })
  } catch {
    res.status(500).json({ error: 'Corrupt save data on server.' })
  }
})

app.put('/api/save', requireAuth, (req: AuthedRequest, res) => {
  const state = req.body?.state
  if (!state || typeof state !== 'object') {
    res.status(400).json({ error: 'Missing game state payload.' })
    return
  }
  let json: string
  try {
    json = JSON.stringify(state)
  } catch {
    res.status(400).json({ error: 'State is not serializable.' })
    return
  }
  if (json.length > 3_500_000) {
    res.status(413).json({ error: 'Save too large.' })
    return
  }
  const updatedAt = upsertSave(req.userId!, json)
  // Best-effort leaderboard snapshot from save
  try {
    const st = state as {
      cash?: number
      reputation?: number
      ownedAircraft?: unknown[]
      routes?: unknown[]
    }
    upsertLeaderboard(
      req.userId!,
      req.username ?? 'player',
      Number(st.cash ?? 0),
      Number(st.reputation ?? 0),
      Array.isArray(st.ownedAircraft) ? st.ownedAircraft.length : 0,
      Array.isArray(st.routes) ? st.routes.length : 0,
    )
  } catch {
    /* ignore */
  }
  res.json({ ok: true, updatedAt })
})

app.delete('/api/save', requireAuth, (req: AuthedRequest, res) => {
  deleteSave(req.userId!)
  res.json({ ok: true })
})

app.get('/api/leaderboard', (_req, res) => {
  res.json({ rows: topLeaderboard(25) })
})

app.post('/api/leaderboard', requireAuth, (req: AuthedRequest, res) => {
  const { cash, reputation, fleet, routes } = req.body ?? {}
  upsertLeaderboard(
    req.userId!,
    req.username ?? 'player',
    Number(cash) || 0,
    Number(reputation) || 0,
    Number(fleet) || 0,
    Number(routes) || 0,
  )
  res.json({ ok: true })
})

// ── Admin ──────────────────────────────────────────────────────────

app.get(
  '/api/admin/players',
  requireAuth,
  requireAdmin,
  (_req: AuthedRequest, res) => {
    const players = listPlayers()
    res.json({
      players,
      total: players.length,
      withSave: players.filter((p) => p.saveUpdatedAt != null).length,
    })
  },
)

app.use(
  (
    err: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    console.error(err)
    res.status(500).json({ error: 'Internal server error.' })
  },
)

await bootstrapAdmin()

app.listen(PORT, () => {
  console.log(`Airline Tycoon API → http://localhost:${PORT}`)
})
