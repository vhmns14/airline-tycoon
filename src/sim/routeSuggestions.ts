/**
 * Destination suggestions ranked by aircraft range + airport fit.
 */

import { airports } from '../data/airports'
import { haversineKm } from '../lib/geo'
import type { Airport, OwnedAircraft } from '../types'
import { airportAcceptsPlane } from './airportRules'
import { effectiveRangeKm } from './cabin'

export type RouteSuggestion = {
  airport: Airport
  distanceKm: number
  /** Higher = better pick for this plane/origin. */
  score: number
  /** Fraction of effective range used (0–1+). */
  rangeUtil: number
}

/**
 * Airports the plane can legally reach from `fromId`
 * (range + min airport size at destination).
 */
export function destinationsInRange(
  plane: OwnedAircraft,
  fromId: string,
): RouteSuggestion[] {
  const from = airports.find((a) => a.id === fromId)
  if (!from) return []

  const range = effectiveRangeKm(plane)
  if (range <= 0) return []

  const out: RouteSuggestion[] = []
  for (const to of airports) {
    if (to.id === fromId) continue
    if (!airportAcceptsPlane(to, plane)) continue
    const distanceKm = haversineKm(from.coords, to.coords)
    if (distanceKm > range) continue
    const rangeUtil = distanceKm / range
    out.push({
      airport: to,
      distanceKm,
      rangeUtil,
      score: scoreSuggestion(to.size, distanceKm, range),
    })
  }

  out.sort((a, b) => b.score - a.score || a.distanceKm - b.distanceKm)
  return out
}

/**
 * Top destinations for chip UI.
 * Prefers larger markets with healthy range utilization (not ultra-short hops).
 */
export function suggestDestinations(
  plane: OwnedAircraft,
  fromId: string,
  limit = 10,
): RouteSuggestion[] {
  return destinationsInRange(plane, fromId).slice(0, limit)
}

function scoreSuggestion(
  size: number,
  distanceKm: number,
  rangeKm: number,
): number {
  // Market demand weight
  const market = size * 1000

  // Prefer using ~25–80% of range (viable hop, not taxi-range or max-edge)
  const util = distanceKm / rangeKm
  let utilBonus = 0
  if (util >= 0.2 && util <= 0.85) {
    utilBonus = 400 + (1 - Math.abs(util - 0.5)) * 200
  } else if (util < 0.2) {
    utilBonus = util * 800 // short hops still OK but ranked lower
  } else {
    utilBonus = 150 // near max range — risky but allowed
  }

  // Mild preference for longer absolute legs among equals (more revenue potential)
  const distanceBonus = Math.min(distanceKm, rangeKm) * 0.05

  return market + utilBonus + distanceBonus
}
