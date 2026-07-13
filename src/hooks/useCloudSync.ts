/**
 * Cloud save: pull on login, debounced push while playing.
 * Guest mode keeps localStorage only.
 */

import { useCallback, useEffect, useRef } from 'react'
import { apiGetSave, apiPutSave } from '../lib/api'
import { useAuthStore } from '../store/authStore'
import {
  hydrateGameState,
  serializeGameState,
  useGameStore,
} from '../store/gameStore'
import type { GameState } from '../types'

const SAVE_DEBOUNCE_MS = 4_000

export function useCloudSync() {
  const token = useAuthStore((s) => s.token)
  const user = useAuthStore((s) => s.user)
  const hydrating = useAuthStore((s) => s.hydrating)
  const setSyncStatus = useAuthStore((s) => s.setSyncStatus)
  const restoreSession = useAuthStore((s) => s.restoreSession)

  const lastPushedJson = useRef<string | null>(null)
  const timerRef = useRef<number | null>(null)
  const pullingRef = useRef(false)

  // Restore JWT session once on boot
  useEffect(() => {
    void restoreSession()
  }, [restoreSession])

  const pushSave = useCallback(
    async (force = false) => {
      const t = useAuthStore.getState().token
      if (!t) return
      const state = serializeGameState(useGameStore.getState())
      const json = JSON.stringify(state)
      if (!force && json === lastPushedJson.current) return

      setSyncStatus('saving', 'Saving to cloud…')
      try {
        const res = await apiPutSave(t, state)
        lastPushedJson.current = json
        setSyncStatus('saved', 'Cloud save OK', res.updatedAt)
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Cloud save failed'
        setSyncStatus('error', msg)
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
      const { save } = await apiGetSave(t)
      const local = serializeGameState(useGameStore.getState())

      if (save?.state) {
        // Cloud is source of truth when logged in
        hydrateGameState(save.state as Partial<GameState>)
        lastPushedJson.current = JSON.stringify(
          serializeGameState(useGameStore.getState()),
        )
        setSyncStatus(
          'saved',
          'Cloud progress loaded',
          save.updatedAt,
        )
      } else if (local.setupComplete) {
        // First login with local progress → upload
        await pushSave(true)
        setSyncStatus('saved', 'Local progress backed up to cloud')
      } else {
        lastPushedJson.current = JSON.stringify(local)
        setSyncStatus('idle', 'No cloud save yet — progress will sync as you play')
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not load cloud save'
      setSyncStatus('error', msg)
    } finally {
      pullingRef.current = false
    }
  }, [pushSave, setSyncStatus])

  // After session ready + logged in → pull cloud
  useEffect(() => {
    if (hydrating) return
    if (!token || !user) {
      lastPushedJson.current = null
      return
    }
    void pullAndMerge()
  }, [hydrating, token, user, pullAndMerge])

  // Debounced auto-save on any game state change
  useEffect(() => {
    if (!token || hydrating) return

    const unsub = useGameStore.subscribe(() => {
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
