/**
 * Airport acceptance + slot fees.
 */

import type { Airport, OwnedAircraft } from '../types'
import { effectiveRangeKm } from './cabin'

/** Opening a route pays slot fees at both ends. */
export function routeSlotFee(from: Airport, to: Airport): number {
  // Softened for real-time — regional pairs stay cheap, mega-hubs still bite
  const sizeSum = from.size + to.size
  // size 2+2 → $9.6k · 5+5 → $28k
  return Math.max(4_500, Math.round(sizeSum * 2_400 + sizeSum * sizeSum * 180))
}

/**
 * Can this aircraft operate from this airport?
 * Small fields reject widebodies via minAirportSize.
 */
export function airportAcceptsPlane(
  airport: Airport,
  plane: OwnedAircraft,
): boolean {
  const minSize = plane.minAirportSize ?? 1
  return airport.size >= minSize
}

export function validateRouteAirports(
  plane: OwnedAircraft,
  from: Airport,
  to: Airport,
  distanceKm: number,
): string | null {
  if (!airportAcceptsPlane(from, plane)) {
    return `${from.code} too small for ${plane.model} (needs size ≥ ${plane.minAirportSize}).`
  }
  if (!airportAcceptsPlane(to, plane)) {
    return `${to.code} too small for ${plane.model} (needs size ≥ ${plane.minAirportSize}).`
  }
  const range = effectiveRangeKm(plane)
  if (range < distanceKm) {
    return `Range too short after cabin config: ${range} km < ${Math.round(distanceKm)} km.`
  }
  return null
}

/** Hub discount on slot fees when operating from home base. */
export function slotFeeWithHub(
  from: Airport,
  to: Airport,
  hubId: string | null,
  congestion = 1,
  /** Alliance codeshare slot discount (0–0.2). */
  allianceDiscount = 0,
): number {
  let fee = routeSlotFee(from, to) * congestion
  if (hubId && (from.id === hubId || to.id === hubId)) {
    fee = Math.round(fee * 0.7)
  }
  if (allianceDiscount > 0) {
    fee = Math.round(fee * (1 - Math.min(0.25, allianceDiscount)))
  }
  return Math.round(fee)
}
