/**
 * 1 Hz wall-clock ticker → store.refreshFlights().
 * Mount once in App via useFlightTicker().
 */

import { useEffect } from 'react'
import { useGameStore } from '../store/gameStore'

const TICK_MS = 1000

export function useFlightTicker(): void {
  useEffect(() => {
    // Catch up immediately on mount / tab focus.
    useGameStore.getState().refreshFlights()

    const id = window.setInterval(() => {
      useGameStore.getState().refreshFlights()
    }, TICK_MS)

    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        useGameStore.getState().refreshFlights()
      }
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])
}
