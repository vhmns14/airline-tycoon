/**
 * Cloud save: pull on login, debounced push while playing.
 * Guest mode keeps localStorage only.
 *
 * Admin cash gifts: server tracks lifetime grants vs state.adminCashReceived.
 * On push/pull the server applies any missing delta and returns cashGranted + cash;
 * client always takes server cash when a grant is applied (avoids overwrite races).
 */

import { useCallback, useEffect, useRef } from 'react'
import {
  enrichCloudWithLocal,
  shouldPreferLocalOverCloud,
} from '../lib/cloudMerge'
import { apiGetSave, apiPutSave } from '../lib/api'
import { useAuthStore } from '../store/authStore'
import {
  hydrateGameState,
  serializeGameState,
  useGameStore,
} from '../store/gameStore'
import type { GameState } from '../types'

const SAVE_DEBOUNCE_MS = 4_000

function applyServerCashGrant(
  cashGranted: number,
  serverCash: number | undefined,
  serverAdminReceived: number | undefined,
) {
  if (!cashGranted || cashGranted === 0) return
  useGameStore.setState((s) => {
    // Prefer absolute values from server (source of truth after grant apply)
    const cash =
      typeof serverCash === 'number' && Number.isFinite(serverCash)
        ? serverCash
        : s.cash + cashGranted
    const adminCashReceived =
      typeof serverAdminReceived === 'number' &&
      Number.isFinite(serverAdminReceived)
        ? serverAdminReceived
        : (s.adminCashReceived ?? 0) + cashGranted
    return {
      cash,
      peakCash: Math.max(s.peakCash, cash),
      adminCashReceived,
      notifications: [
        {
          id: crypto.randomUUID(),
          at: Date.now(),
          tone: (cashGranted >= 0 ? 'good' : 'warn') as 'good' | 'warn',
          text:
            cashGranted >= 0
              ? `Admin gift +$${Math.round(cashGranted).toLocaleString()}`
              : `Admin fine −$${Math.round(Math.abs(cashGranted)).toLocaleString()}`,
        },
        ...(s.notifications ?? []),
      ].slice(0, 40),
    }
  })
}

export function useCloudSync() {
  const token = useAuthStore((s) => s.token)
  const user = useAuthStore((s) => s.user)
  const hydrating = useAuthStore((s) => s.hydrating)
  const setSyncStatus = useAuthStore((s) => s.setSyncStatus)
  const restoreSession = useAuthStore((s) => s.restoreSession)

  const lastPushedJson = useRef<string | null>(null)
  const timerRef = useRef<number | null>(null)
  const pullingRef = useRef(false)
  const pushingRef = useRef(false)
  /** Block auto-push until first cloud pull finishes (prevents grant wipe). */
  const pullReadyRef = useRef(false)

  // Restore JWT session once on boot
  useEffect(() => {
    void restoreSession()
  }, [restoreSession])

  const pushSave = useCallback(
    async (force = false) => {
      const t = useAuthStore.getState().token
      if (!t) return
      if (!pullReadyRef.current && !force) return
      if (pushingRef.current) return
      if (pullingRef.current) return

      const state = serializeGameState(useGameStore.getState())
      const json = JSON.stringify(state)
      if (!force && json === lastPushedJson.current) return

      pushingRef.current = true
      setSyncStatus('saving', 'Saving to cloud…')
      try {
        const res = await apiPutSave(t, state)
        if (res.cashGranted && res.cashGranted !== 0) {
          applyServerCashGrant(
            res.cashGranted,
            res.cash,
            res.adminCashReceived,
          )
          lastPushedJson.current = JSON.stringify(
            serializeGameState(useGameStore.getState()),
          )
          setSyncStatus(
            'saved',
            `Cloud save OK · admin ${res.cashGranted >= 0 ? 'gift' : 'fine'} ${res.cashGranted >= 0 ? '+' : ''}$${Math.round(res.cashGranted).toLocaleString()}`,
            res.updatedAt,
          )
        } else {
          lastPushedJson.current = json
          setSyncStatus('saved', 'Cloud save OK', res.updatedAt)
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Cloud save failed'
        setSyncStatus('error', msg)
      } finally {
        pushingRef.current = false
      }
    },
    [setSyncStatus],
  )

  const pullAndMerge = useCallback(async () => {
    const t = useAuthStore.getState().token
    if (!t || pullingRef.current) return
    pullingRef.current = true
    setSyncStatus('loading', 'Loading cloud save…')
    try {
      const { save, cashGranted } = await apiGetSave(t)
      const local = serializeGameState(useGameStore.getState())

      if (save?.state) {
        const cloud = save.state as Partial<GameState>

        // Don't let an empty/stale cloud wipe a richer local airline
        if (shouldPreferLocalOverCloud(local, cloud)) {
          pullReadyRef.current = true
          await pushSave(true)
          setSyncStatus(
            'saved',
            'Kept local progress (cloud was behind) · uploaded',
            save.updatedAt,
          )
        } else {
          // Merge: cloud base + any local-only routes/planes
          const merged = enrichCloudWithLocal(cloud, local)
          hydrateGameState(merged)
          lastPushedJson.current = JSON.stringify(
            serializeGameState(useGameStore.getState()),
          )
          // If we recovered local-only routes, push merged state up
          const mergedRoutes = merged.routes?.length ?? 0
          const cloudRoutes = cloud.routes?.length ?? 0
          if (mergedRoutes > cloudRoutes) {
            pullReadyRef.current = true
            await pushSave(true)
          }
          if (cashGranted && cashGranted !== 0) {
            setSyncStatus(
              'saved',
              `Cloud loaded · admin ${cashGranted >= 0 ? 'gift' : 'fine'} applied`,
              save.updatedAt,
            )
          } else {
            setSyncStatus('saved', 'Cloud progress loaded', save.updatedAt)
          }
        }
      } else if (local.setupComplete) {
        pullReadyRef.current = true
        await pushSave(true)
        setSyncStatus('saved', 'Local progress backed up to cloud')
      } else {
        lastPushedJson.current = JSON.stringify(local)
        setSyncStatus(
          'idle',
          'No cloud save yet — progress will sync as you play',
        )
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not load cloud save'
      setSyncStatus('error', msg)
    } finally {
      pullingRef.current = false
      pullReadyRef.current = true
    }
  }, [pushSave, setSyncStatus])

  // After session ready + logged in → pull cloud first
  useEffect(() => {
    if (hydrating) return
    if (!token || !user) {
      lastPushedJson.current = null
      pullReadyRef.current = false
      return
    }
    pullReadyRef.current = false
    void pullAndMerge()
  }, [hydrating, token, user, pullAndMerge])

  // Debounced auto-save on any game state change (after pull ready)
  useEffect(() => {
    if (!token || hydrating) return

    const unsub = useGameStore.subscribe(() => {
      if (!pullReadyRef.current) return
      if (timerRef.current) window.clearTimeout(timerRef.current)
      timerRef.current = window.setTimeout(() => {
        void pushSave(false)
      }, SAVE_DEBOUNCE_MS)
    })

    return () => {
      unsub()
      if (timerRef.current) window.clearTimeout(timerRef.current)
    }
  }, [token, hydrating, pushSave])

  // Flush on tab hide / unload
  useEffect(() => {
    if (!token) return

    const flush = () => {
      if (!pullReadyRef.current) return
      void pushSave(true)
    }
    const onVis = () => {
      if (document.visibilityState === 'hidden') flush()
    }
    window.addEventListener('beforeunload', flush)
    document.addEventListener('visibilitychange', onVis)
    return () => {
      window.removeEventListener('beforeunload', flush)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [token, pushSave])

  return { pushSave, pullAndMerge }
}
