/**
 * Unlockable achievements (separate from career goals).
 */

import type { GameState } from '../types'

export type AchievementDef = {
  id: string
  title: string
  hint: string
}

export const ACHIEVEMENT_DEFS: AchievementDef[] = [
  { id: 'first_jumbo', title: 'Widebody owner', hint: 'Own/lease a jumbo (220+ seats)' },
  { id: 'ten_routes', title: 'Networker', hint: 'Operate 10 routes' },
  { id: 'debt_free', title: 'Debt free', hint: 'Clear all bank loans after borrowing once' },
  { id: 'millionaire', title: 'Peak $5M', hint: 'Hit $5M peak cash' },
  { id: 'cargo_king', title: 'Cargo king', hint: '3+ freighters in fleet' },
  { id: 'public', title: 'Listed', hint: 'Complete an IPO' },
  { id: 'insured', title: 'Covered', hint: 'File an insurance claim' },
  { id: 'auto_pilot', title: 'Automation', hint: 'Enable auto-fly on any route' },
]

export function evaluateNewAchievements(s: GameState): string[] {
  const unlocked = new Set(s.achievements ?? [])
  const add: string[] = []
  const has = (id: string) => {
    if (!unlocked.has(id)) add.push(id)
  }

  const jumbo = s.ownedAircraft.some(
    (a) => a.role === 'passenger' && (a.capacity >= 220 || a.bodyClass === 'widebody' || a.bodyClass === 'super'),
  )
  if (jumbo) has('first_jumbo')
  if (s.routes.length >= 10) has('ten_routes')
  if ((s.loans?.length ?? 0) === 0 && s.peakCash > 1_200_000) has('debt_free')
  if (s.peakCash >= 5_000_000) has('millionaire')
  if (s.ownedAircraft.filter((a) => a.role === 'cargo').length >= 3) has('cargo_king')
  if (s.isPublic) has('public')
  if ((s.insuranceClaims ?? []).some((c) => c.claimed)) has('insured')
  if (s.routes.some((r) => r.autoFly)) has('auto_pilot')

  return add
}
