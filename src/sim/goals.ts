/**
 * Career goals — give the player a clear short-term path.
 */

import type { GameState } from '../types'

export type Goal = {
  id: string
  title: string
  hint: string
  done: boolean
  /** Optional cash reward flavor (not auto-paid — motivational only unless wired). */
  badge: string
}

export function evaluateGoals(s: GameState): Goal[] {
  const fleet = s.ownedAircraft.length
  const routes = s.routes.length
  const flying = s.ownedAircraft.filter(
    (a) => a.flight?.status === 'IN_FLIGHT',
  ).length
  const cargo = s.ownedAircraft.some((a) => a.role === 'cargo')
  const hasFuel = s.fuelStock >= 2000
  const hub = Boolean(s.hubId)
  const alliance = Boolean(s.allianceId)
  const cash2m = s.peakCash >= 2_000_000
  const cash5m = s.peakCash >= 5_000_000
  const rep70 = s.reputation >= 70
  const staffed =
    s.pilots >= Math.max(2, fleet * 2) &&
    s.cabinCrew >= Math.max(2, fleet)

  return [
    {
      id: 'brand',
      title: 'Found your airline',
      hint: 'Complete setup with name & hub',
      done: s.setupComplete && hub,
      badge: 'CEO',
    },
    {
      id: 'first-plane',
      title: 'Acquire first aircraft',
      hint: 'Market → Rent or Buy (Cessna / ATR is fine)',
      done: fleet >= 1,
      badge: 'Operator',
    },
    {
      id: 'fuel-up',
      title: 'Stock the fuel farm',
      hint: 'Fuel tab → buy at least 2,000 L',
      done: hasFuel,
      badge: 'Tanker',
    },
    {
      id: 'first-route',
      title: 'Open first route',
      hint: 'Routes → pick plane, From/To, open',
      done: routes >= 1,
      badge: 'Network',
    },
    {
      id: 'wheels-up',
      title: 'Get a flight airborne',
      hint: 'Need fuel + plane on a route',
      done: flying >= 1,
      badge: 'Airborne',
    },
    {
      id: 'crew',
      title: 'Fully staff the operation',
      hint: 'Company → hire pilots & cabin crew',
      done: staffed && fleet >= 1,
      badge: 'Crewed',
    },
    {
      id: 'cargo',
      title: 'Enter the cargo market',
      hint: 'Market → rent a freighter',
      done: cargo,
      badge: 'Freight',
    },
    {
      id: 'expand',
      title: 'Run 3 routes',
      hint: 'Grow the network',
      done: routes >= 3,
      badge: 'Expand',
    },
    {
      id: 'cash2m',
      title: 'Peak treasury $2,000,000',
      hint: 'Profitable legs + fuel discipline',
      done: cash2m,
      badge: 'Solid',
    },
    {
      id: 'alliance',
      title: 'Join an alliance',
      hint: 'Company → SkyLink Alliance',
      done: alliance,
      badge: 'Allied',
    },
    {
      id: 'rep',
      title: 'Reputation 70+',
      hint: 'On-time ops, staffed flights',
      done: rep70,
      badge: 'Trusted',
    },
    {
      id: 'cash5m',
      title: 'Peak treasury $5,000,000',
      hint: 'Long-haul or dense short-haul empire',
      done: cash5m,
      badge: 'Tycoon',
    },
  ]
}

export function goalsProgress(goals: Goal[]): {
  done: number
  total: number
  next: Goal | undefined
  allDone: boolean
} {
  const done = goals.filter((g) => g.done).length
  return {
    done,
    total: goals.length,
    next: goals.find((g) => !g.done),
    allDone: done === goals.length,
  }
}
