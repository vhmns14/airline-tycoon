/**
 * HTTP client for Airline Tycoon cloud API.
 */

import type { GameState } from '../types'

const API_BASE = '' // same-origin / vite proxy

export type AuthUser = {
  id: string
  username: string
  /** Server-side admin flag (player list console). */
  isAdmin?: boolean
}

export type AuthResponse = {
  token: string
  user: AuthUser
}

export type CloudSave = {
  state: GameState
  updatedAt: number
}

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
    this.name = 'ApiError'
  }
}

async function request<T>(
  path: string,
  options: RequestInit & { token?: string | null } = {},
): Promise<T> {
  const { token, headers: extra, ...rest } = options
  const headers = new Headers(extra)
  if (rest.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  let res: Response
  try {
    res = await fetch(`${API_BASE}${path}`, { ...rest, headers })
  } catch {
    throw new ApiError(
      0,
      'Cannot reach server. Is the API running? (npm run dev)',
    )
  }

  const data = (await res.json().catch(() => ({}))) as {
    error?: string
  } & T

  if (!res.ok) {
    throw new ApiError(
      res.status,
      typeof data.error === 'string' ? data.error : `Request failed (${res.status})`,
    )
  }
  return data as T
}

export function apiRegister(
  username: string,
  password: string,
): Promise<AuthResponse> {
  return request<AuthResponse>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  })
}

export function apiLogin(
  username: string,
  password: string,
): Promise<AuthResponse> {
  return request<AuthResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  })
}

export function apiMe(token: string): Promise<{ user: AuthUser }> {
  return request('/api/auth/me', { token })
}

export function apiGetSave(
  token: string,
): Promise<{ save: CloudSave | null }> {
  return request('/api/save', { token })
}

export function apiPutSave(
  token: string,
  state: GameState,
): Promise<{ ok: boolean; updatedAt: number }> {
  return request('/api/save', {
    method: 'PUT',
    token,
    body: JSON.stringify({ state }),
  })
}

export function apiDeleteSave(token: string): Promise<{ ok: boolean }> {
  return request('/api/save', { method: 'DELETE', token })
}

export type LeaderboardRow = {
  user_id: string
  username: string
  cash: number
  reputation: number
  fleet: number
  routes: number
  updated_at: number
}

export function apiLeaderboard(): Promise<{ rows: LeaderboardRow[] }> {
  return request('/api/leaderboard')
}

export function apiPostLeaderboard(
  token: string,
  stats: {
    cash: number
    reputation: number
    fleet: number
    routes: number
  },
): Promise<{ ok: boolean }> {
  return request('/api/leaderboard', {
    method: 'POST',
    token,
    body: JSON.stringify(stats),
  })
}

export type AdminPlayer = {
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

export type AdminPlayersResponse = {
  players: AdminPlayer[]
  total: number
  withSave: number
}

export function apiAdminPlayers(
  token: string,
): Promise<AdminPlayersResponse> {
  return request('/api/admin/players', { token })
}
