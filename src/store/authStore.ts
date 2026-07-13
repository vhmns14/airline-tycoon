/**
 * Auth session (JWT in localStorage). Independent of game state.
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  apiLogin,
  apiMe,
  apiRegister,
  type AuthUser,
} from '../lib/api'

const AUTH_KEY = 'airline-tycoon-auth'

type AuthState = {
  token: string | null
  user: AuthUser | null
  /** Bootstrapping session from stored token. */
  hydrating: boolean
  /** Last cloud sync status for UI. */
  syncStatus: 'idle' | 'saving' | 'saved' | 'error' | 'loading'
  syncMessage: string | null
  lastSyncedAt: number | null

  login: (username: string, password: string) => Promise<void>
  register: (username: string, password: string) => Promise<void>
  logout: () => void
  restoreSession: () => Promise<void>
  setSyncStatus: (
    status: AuthState['syncStatus'],
    message?: string | null,
    at?: number | null,
  ) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      hydrating: true,
      syncStatus: 'idle',
      syncMessage: null,
      lastSyncedAt: null,

      login: async (username, password) => {
        const res = await apiLogin(username, password)
        set({
          token: res.token,
          user: res.user,
          syncMessage: null,
          syncStatus: 'idle',
        })
      },

      register: async (username, password) => {
        const res = await apiRegister(username, password)
        set({
          token: res.token,
          user: res.user,
          syncMessage: null,
          syncStatus: 'idle',
        })
      },

      logout: () => {
        set({
          token: null,
          user: null,
          syncStatus: 'idle',
          syncMessage: null,
          lastSyncedAt: null,
        })
      },

      restoreSession: async () => {
        const token = get().token
        if (!token) {
          set({ hydrating: false, user: null })
          return
        }
        try {
          const { user } = await apiMe(token)
          set({ user, hydrating: false })
        } catch {
          set({
            token: null,
            user: null,
            hydrating: false,
            syncMessage: 'Session expired — log in again to sync.',
          })
        }
      },

      setSyncStatus: (status, message = null, at = undefined) => {
        set({
          syncStatus: status,
          syncMessage: message,
          ...(at !== undefined ? { lastSyncedAt: at } : {}),
        })
      },
    }),
    {
      name: AUTH_KEY,
      partialize: (s) => ({
        token: s.token,
        user: s.user,
        lastSyncedAt: s.lastSyncedAt,
      }),
    },
  ),
)
