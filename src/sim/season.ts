/**
 * Weekly season goals + local scoreboard (browser only).
 */

import type { SeasonGoal } from '../types'

export function seasonWeekKey(now = Date.now()): string {
  const d = new Date(now)
  const day = d.getDay() || 7
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - day + 1)
  return d.toISOString().slice(0, 10)
}

export function createSeasonGoal(weekKey: string): SeasonGoal {
  return {
    weekKey,
    targetLegs: 12,
    targetRevenue: 80_000,
    legs: 0,
    revenue: 0,
    claimed: false,
  }
}

export function ensureSeasonGoal(
  goal: SeasonGoal | undefined,
  now: number,
): SeasonGoal {
  const wk = seasonWeekKey(now)
  if (!goal || goal.weekKey !== wk) return createSeasonGoal(wk)
  return goal
}

export function seasonComplete(g: SeasonGoal): boolean {
  return g.legs >= g.targetLegs && g.revenue >= g.targetRevenue
}

export function seasonReward(g: SeasonGoal): number {
  return 45_000 + Math.round(g.targetRevenue * 0.15)
}

export type LocalScore = {
  weekKey: string
  name: string
  score: number
  at: number
}

export function rankScores(scores: LocalScore[], weekKey: string): LocalScore[] {
  return [...scores]
    .filter((s) => s.weekKey === weekKey)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
}

export function scoreFromState(
  peakCash: number,
  legs: number,
  revenue: number,
  rep: number,
): number {
  return Math.round(peakCash * 0.01 + legs * 500 + revenue * 0.2 + rep * 100)
}
