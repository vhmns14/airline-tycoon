/**
 * Airline Tycoon Express app (shared by local server + Vercel serverless).
 *
 * Local:  npx tsx --experimental-sqlite server/index.ts
 * Vercel: api/index.ts exports this app
 * Env: JWT_SECRET, ADMIN_USERNAME, ADMIN_PASSWORD (see .env / Vercel env)
 */

import cors from 'cors'
import express from 'express'
import { randomUUID } from 'node:crypto'
import { loadEnvFile } from './loadEnv.ts'
import {
  applyPendingCashGrants,
  createCashGrant,
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

// .env already loaded via loadEnv.ts import side-effect (and again here is fine)
loadEnvFile()

export const app = express()

app.use(cors({ origin: true, credentials: true }))
app.use(express.json({ limit: '4mb' }))

/** Resolve once; used by local listen + serverless cold start. */
export const adminReady = bootstrapAdmin().catch((err) => {
  console.error('Admin bootstrap failed', err)
})

// Ensure admin seed before requests (must register before routes)
app.use(async (_req, _res, next) => {
  try {
    await adminReady
  } catch {
    /* already logged */
  }
  next()
})

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
    isAdmin: isUserAdmin(user as import('./db.ts').DbUser),
  }
}

/**
 * Ensure admin account from local env only (never hardcode credentials in source).
 * Requires ADMIN_USERNAME + ADMIN_PASSWORD in .env or process env.
 * Set ADMIN_RESET_PASSWORD=1 to force password back to ADMIN_PASSWORD on boot.
 */
async function bootstrapAdmin(): Promise<void> {
  const username = process.env.ADMIN_USERNAME?.trim()
  const password = process.env.ADMIN_PASSWORD
  if (!username || !password) {
    console.log(
      'Admin: skip seed (set ADMIN_USERNAME + ADMIN_PASSWORD in local .env — not committed)',
    )
    return
  }
  if (password.length < 6) {
    console.warn('Admin: ADMIN_PASSWORD must be at least 6 characters — skipped')
    return
  }

  const forceReset =
    process.env.ADMIN_RESET_PASSWORD === '1' ||
    process.env.ADMIN_RESET_PASSWORD === 'true'

  const existing = findUserByUsername(username)
  if (existing) {
    if (!isUserAdmin(existing)) {
      setUserAdmin(existing.id, true)
      console.log(`Admin: promoted @${existing.username}`)
    } else {
      console.log(`Admin: ready @${existing.username}`)
    }
    if (forceReset) {
      const hash = await hashPassword(password)
      setUserPasswordHash(existing.id, hash)
      console.log(`Admin: password reset for @${existing.username}`)
    }
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
  // First-ever account becomes admin only if no admin seed account exists yet
  const makeAdmin = countUsers() === 0
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

/** Change password for the logged-in account (keeps admin flag). */
app.post('/api/auth/password', requireAuth, async (req: AuthedRequest, res) => {
  const { currentPassword, newPassword } = req.body ?? {}
  if (typeof currentPassword !== 'string' || typeof newPassword !== 'string') {
    res.status(400).json({ error: 'currentPassword and newPassword required.' })
    return
  }
  if (newPassword.length < 6 || newPassword.length > 72) {
    res.status(400).json({ error: 'New password must be 6–72 characters.' })
    return
  }
  const user = findUserById(req.userId!)
  if (!user) {
    res.status(401).json({ error: 'Account not found.' })
    return
  }
  if (!(await verifyPassword(currentPassword, user.password_hash))) {
    res.status(401).json({ error: 'Current password is wrong.' })
    return
  }
  const hash = await hashPassword(newPassword)
  setUserPasswordHash(user.id, hash)
  res.json({ ok: true })
})

app.get('/api/save', requireAuth, (req: AuthedRequest, res) => {
  const save = getSave(req.userId!)
  if (!save) {
    // No save yet — still apply grants into an empty shell? Skip until they have a save.
    res.json({ save: null, cashGranted: 0 })
    return
  }
  try {
    let state = JSON.parse(save.state_json) as Record<string, unknown>
    const applied = applyPendingCashGrants(req.userId!, state)
    state = applied.state
    let updatedAt = save.updated_at
    if (applied.granted > 0) {
      updatedAt = upsertSave(req.userId!, JSON.stringify(state))
      try {
        upsertLeaderboard(
          req.userId!,
          req.username ?? 'player',
          Number(state.cash ?? 0),
          Number(state.reputation ?? 0),
          Array.isArray(state.ownedAircraft) ? state.ownedAircraft.length : 0,
          Array.isArray(state.routes) ? state.routes.length : 0,
        )
      } catch {
        /* ignore */
      }
    }
    res.json({
      save: {
        state,
        updatedAt,
      },
      cashGranted: applied.granted,
    })
  } catch {
    res.status(500).json({ error: 'Corrupt save data on server.' })
  }
})

app.put('/api/save', requireAuth, (req: AuthedRequest, res) => {
  let state = req.body?.state
  if (!state || typeof state !== 'object') {
    res.status(400).json({ error: 'Missing game state payload.' })
    return
  }
  // Apply admin gifts on top of whatever the client sent
  const applied = applyPendingCashGrants(
    req.userId!,
    state as Record<string, unknown>,
  )
  state = applied.state

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
  res.json({
    ok: true,
    updatedAt,
    cashGranted: applied.granted,
    cash: Number((state as { cash?: number }).cash ?? 0),
    adminCashReceived: Number(
      (state as { adminCashReceived?: number }).adminCashReceived ?? 0,
    ),
  })
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

/** Gift in-game cash to a cloud player (applied on their next pull/push). */
app.post(
  '/api/admin/grant-cash',
  requireAuth,
  requireAdmin,
  (req: AuthedRequest, res) => {
    const { userId, username, amount, note } = req.body ?? {}
    const amt = Number(amount)
    if (!Number.isFinite(amt) || amt === 0) {
      res.status(400).json({ error: 'amount must be a non-zero number.' })
      return
    }
    if (Math.abs(amt) > 1_000_000_000) {
      res.status(400).json({ error: 'amount too large (max ±1e9).' })
      return
    }
    let target = typeof userId === 'string' ? findUserById(userId) : undefined
    if (!target && typeof username === 'string') {
      target = findUserByUsername(username)
    }
    if (!target) {
      res.status(404).json({ error: 'Player not found.' })
      return
    }
    const noteStr =
      typeof note === 'string' ? note.trim().slice(0, 120) || null : null
    const grant = createCashGrant(
      randomUUID(),
      target.id,
      amt,
      noteStr,
      req.username ?? null,
    )

    // Stays pending until the player cloud-syncs (GET/PUT /api/save).
    // That way online clients receive cashGranted on next push and bump local cash.
    const save = getSave(target.id)
    res.json({
      ok: true,
      grant: {
        id: grant.id,
        userId: target.id,
        username: target.username,
        amount: amt,
        note: noteStr,
      },
      pending: true,
      hasCloudSave: !!save,
      message: save
        ? `Queued ${amt >= 0 ? '+' : ''}$${Math.round(amt).toLocaleString()} for @${target.username} — applies on their next cloud sync (~4s if online).`
        : `Queued for @${target.username} — no cloud save yet; applies when they log in & save.`,
    })
  },
)

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

export default app
