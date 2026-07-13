/**
 * Fuel market + consumption helpers.
 *
 * Shared farm storage. Fuel is uplifted in ONE shot at departure
 * (full leg requirement — never progressive mid-flight cuts).
 * Market price drifts randomly every few real-time minutes.
 */

import { airports } from '../data/airports'
import { haversineKm } from '../lib/geo'
import { clamp } from '../lib/math'
import type { OwnedAircraft } from '../types'

/** Default shared fuel farm capacity (liters). */
export const DEFAULT_FUEL_CAPACITY = 50_000

/** Starting stock so the first short legs are possible. */
export const DEFAULT_FUEL_STOCK = 10_000

/** Market price bounds ($ / liter). */
export const FUEL_PRICE_MIN = 0.5
export const FUEL_PRICE_MAX = 2.65
export const FUEL_PRICE_BASE = 1.05

/** How often the market re-rolls (real wall-clock). */
export const FUEL_PRICE_UPDATE_MS = 3 * 60 * 1000

/**
 * Aircraft `fuelCostPerKm` is treated as liters burned per km (game units).
 */
export function fuelLitersForDistance(
  plane: OwnedAircraft,
  distanceKm: number,
): number {
  return Math.max(0, distanceKm * plane.fuelCostPerKm)
}

/** Full one-way leg burn (liters), no partials. */
export function fuelLitersForLeg(
  plane: OwnedAircraft,
  fromId: string,
  toId: string,
): number {
  const from = airports.find((a) => a.id === fromId)
  const to = airports.find((a) => a.id === toId)
  if (!from || !to) return 0
  return fuelLitersForDistance(
    plane,
    haversineKm(from.coords, to.coords),
  )
}

/**
 * Dispatch uplift: full fuel for this departure taken from storage at once.
 * `frequency` multiplies sector intensity (2× / 3× routes uplift more).
 * Never splits a single dispatch into mid-flight partial cuts.
 */
export function fuelUpliftForDispatch(
  plane: OwnedAircraft,
  fromId: string,
  toId: string,
  frequency: 1 | 2 | 3 = 1,
): number {
  const oneWay = fuelLitersForLeg(plane, fromId, toId)
  const freq = Math.max(1, Math.min(3, frequency))
  return Math.round(oneWay * freq)
}

/** Random price in [min, max], mildly centered on previous price. */
export function rollFuelPrice(previous: number): number {
  // Random walk: ±25% of current, then hard clamp to market band.
  const jitter = 0.75 + Math.random() * 0.5 // 0.75–1.25
  const next = previous * jitter
  // Occasional spike / dump
  const shock = Math.random() < 0.12 ? 0.7 + Math.random() * 0.7 : 1
  return clamp(
    Math.round(next * shock * 100) / 100,
    FUEL_PRICE_MIN,
    FUEL_PRICE_MAX,
  )
}

export function initialFuelPrice(): number {
  return clamp(
    Math.round((FUEL_PRICE_BASE * (0.9 + Math.random() * 0.25)) * 100) / 100,
    FUEL_PRICE_MIN,
    FUEL_PRICE_MAX,
  )
}
