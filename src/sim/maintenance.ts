/**
 * Airframe condition, wear, AOG, repair & resale value.
 */

import type { OwnedAircraft } from '../types'

export const REPAIR_FULL_COST_FRAC = 0.08 // 8% of price for full restore
export const AOG_THRESHOLD = 18 // condition below → risk AOG
export const SELL_BASE_FRAC = 0.62 // used market floor before condition

export function defaultCondition(now: number): Pick<
  OwnedAircraft,
  'condition' | 'flightHours' | 'aogUntil' | 'lastMaintAt'
> {
  return {
    condition: 100,
    flightHours: 0,
    aogUntil: null,
    lastMaintAt: now,
  }
}

/** Wear after a completed leg. Longer legs + high frequency wear more. */
export function wearFromLeg(
  plane: OwnedAircraft,
  distanceKm: number,
  frequency: number,
): OwnedAircraft {
  const hours = distanceKm / Math.max(200, plane.speedKmh)
  const wear = 0.08 + hours * 0.35 + frequency * 0.05
  let condition = Math.max(0, plane.condition - wear)
  let aogUntil = plane.aogUntil
  // Random AOG if poorly maintained
  if (condition < AOG_THRESHOLD && Math.random() < 0.04) {
    aogUntil = Date.now() + (2 + Math.random() * 4) * 60 * 60 * 1000 // 2–6h
  }
  return {
    ...plane,
    condition,
    flightHours: plane.flightHours + hours,
    aogUntil,
  }
}

export function isAog(plane: OwnedAircraft, now = Date.now()): boolean {
  return plane.aogUntil != null && plane.aogUntil > now
}

export function repairCost(plane: OwnedAircraft, toCondition = 100): number {
  const need = Math.max(0, toCondition - plane.condition)
  if (need <= 0) return 0
  return Math.round(plane.price * REPAIR_FULL_COST_FRAC * (need / 100))
}

export function applyRepair(
  plane: OwnedAircraft,
  now: number,
  toCondition = 100,
): OwnedAircraft {
  return {
    ...plane,
    condition: Math.min(100, toCondition),
    aogUntil: null,
    lastMaintAt: now,
  }
}

/** Resale price for OWNED aircraft. */
export function sellValue(plane: OwnedAircraft): number {
  const ageYears = (Date.now() - plane.acquiredAt) / (365 * 24 * 60 * 60 * 1000)
  const ageMult = Math.max(0.35, 1 - ageYears * 0.12)
  const condMult = 0.4 + (plane.condition / 100) * 0.6
  return Math.round(plane.price * SELL_BASE_FRAC * ageMult * condMult)
}

/** Fee to return a leased aircraft early. */
export function leaseReturnFee(plane: OwnedAircraft): number {
  return Math.round(plane.dailyLeaseCost * 7)
}

/** Condition penalty on demand/load (0.7–1). */
export function conditionDemandMult(condition: number): number {
  if (condition >= 80) return 1
  if (condition >= 50) return 0.92
  if (condition >= 25) return 0.8
  return 0.65
}
