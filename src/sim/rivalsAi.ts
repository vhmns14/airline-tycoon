/**
 * Periodic rival pressure: slowly add OD pairs from player's network.
 */

import { odKey } from '../data/rivals'
import type { RivalAirline, Route } from '../types'

const RIVAL_TICK_MS = 12 * 60 * 1000 // every 12 real minutes

export function maybeExpandRivals(
  rivals: RivalAirline[],
  playerRoutes: Route[],
  now: number,
  lastTickAt: number,
  difficultyBias = 1,
): { rivals: RivalAirline[]; expanded: string | null; nextTickAt: number } {
  const interval = RIVAL_TICK_MS / Math.max(0.5, difficultyBias)
  if (now - lastTickAt < interval) {
    return { rivals, expanded: null, nextTickAt: lastTickAt }
  }
  if (playerRoutes.length === 0 || Math.random() > 0.45) {
    return { rivals, expanded: null, nextTickAt: now }
  }

  // Steal a player OD
  const r = playerRoutes[Math.floor(Math.random() * playerRoutes.length)]
  const key = odKey(r.fromId, r.toId)
  const idx = Math.floor(Math.random() * rivals.length)
  const rival = rivals[idx]
  if (rival.routes.includes(key)) {
    return { rivals, expanded: null, nextTickAt: now }
  }
  const next = rivals.map((rv, i) =>
    i === idx ? { ...rv, routes: [...rv.routes, key] } : rv,
  )
  return {
    rivals: next,
    expanded: `${rival.name} entered ${key.replace('|', '–')}`,
    nextTickAt: now,
  }
}
