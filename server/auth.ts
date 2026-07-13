/**
 * Password hashing + JWT helpers.
 */

import bcrypt from 'bcryptjs'
import { SignJWT, jwtVerify } from 'jose'

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET ?? 'airline-tycoon-dev-secret-change-me',
)
const TOKEN_TTL = '30d'
const BCRYPT_ROUNDS = 10

export type JwtPayload = {
  sub: string
  username: string
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS)
}

export async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

export async function signToken(payload: JwtPayload): Promise<string> {
  return new SignJWT({ username: payload.username })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(TOKEN_TTL)
    .sign(JWT_SECRET)
}

export async function verifyToken(token: string): Promise<JwtPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET)
    const sub = payload.sub
    const username = payload.username
    if (typeof sub !== 'string' || typeof username !== 'string') return null
    return { sub, username }
  } catch {
    return null
  }
}

const USERNAME_RE = /^[a-zA-Z0-9_]{3,24}$/

export function validateCredentials(
  username: unknown,
  password: unknown,
): string | null {
  if (typeof username !== 'string' || typeof password !== 'string') {
    return 'Username and password are required.'
  }
  const u = username.trim()
  if (!USERNAME_RE.test(u)) {
    return 'Username: 3–24 chars, letters/numbers/underscore only.'
  }
  if (password.length < 6 || password.length > 72) {
    return 'Password must be 6–72 characters.'
  }
  return null
}
