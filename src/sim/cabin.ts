/**
 * Cabin density + class split helpers (passenger aircraft).
 */

import type {
  Aircraft,
  CabinConfig,
  CabinDensity,
  OwnedAircraft,
} from '../types'

const DENSITY: Record<
  CabinDensity,
  { seatMult: number; rangeMult: number; label: string }
> = {
  dense: { seatMult: 1.12, rangeMult: 0.92, label: 'Dense' },
  standard: { seatMult: 1, rangeMult: 1, label: 'Standard' },
  comfort: { seatMult: 0.88, rangeMult: 1.1, label: 'Comfort' },
}

export function densityInfo(d: CabinDensity) {
  return DENSITY[d]
}

/**
 * Configurable cabin UI for jet airliners (not small perintis props).
 * light / turboprop / tiny regional skip the modal.
 */
export function isJumboPassenger(
  plane: Pick<Aircraft, 'role' | 'bodyClass' | 'capacity'>,
): boolean {
  if (plane.role !== 'passenger') return false
  if (plane.bodyClass === 'light' || plane.bodyClass === 'turboprop') {
    return false
  }
  // regional jets + narrowbody + widebody + super
  if (
    plane.bodyClass === 'regional' ||
    plane.bodyClass === 'narrowbody' ||
    plane.bodyClass === 'widebody' ||
    plane.bodyClass === 'super'
  ) {
    return true
  }
  return plane.capacity >= 50
}

/**
 * Purchase / lease price scales with cabin mix.
 * More J/F and comfort density → more expensive; dense all-Y → cheaper.
 */
export function cabinPurchasePrice(
  basePrice: number,
  cabin: CabinConfig,
  baseCapacity: number,
): number {
  const max = maxSeatsFor(baseCapacity, cabin.density)
  if (max <= 0) return basePrice
  // Weighted “seat product” vs default 78/16/6 mix
  const weighted =
    cabin.economy * 1 + cabin.business * 2.35 + cabin.first * 4.5
  const defaultWeighted = max * (0.78 * 1 + 0.16 * 2.35 + 0.06 * 4.5)
  const mixMult = weighted / defaultWeighted
  const densityMult =
    cabin.density === 'dense' ? 0.94 : cabin.density === 'comfort' ? 1.1 : 1
  const mult = Math.min(1.55, Math.max(0.82, mixMult * densityMult))
  return Math.round(basePrice * mult)
}

export function cabinLeasePrice(
  baseDaily: number,
  cabin: CabinConfig,
  baseCapacity: number,
): number {
  const buy = cabinPurchasePrice(100_000, cabin, baseCapacity)
  const mult = buy / 100_000
  return Math.round(baseDaily * mult)
}

export function maxSeatsFor(
  baseCapacity: number,
  density: CabinDensity = 'standard',
): number {
  return Math.max(10, Math.round(baseCapacity * DENSITY[density].seatMult))
}

/** Build default 78% Y / 16% J / 6% F layout after density. */
export function defaultCabin(
  baseCapacity: number,
  density: CabinDensity = 'standard',
): CabinConfig {
  const seats = maxSeatsFor(baseCapacity, density)
  const first = Math.max(0, Math.round(seats * 0.06))
  const business = Math.max(0, Math.round(seats * 0.16))
  const economy = Math.max(1, seats - first - business)
  return { density, economy, business, first }
}

/**
 * Build cabin from class targets; cabin is always fully filled (Y absorbs rest).
 */
export function cabinFromClasses(
  baseCapacity: number,
  economy: number,
  business: number,
  first: number,
  density: CabinDensity = 'standard',
): CabinConfig {
  const max = maxSeatsFor(baseCapacity, density)
  let f = Math.max(0, Math.round(first))
  let j = Math.max(0, Math.round(business))
  let y = Math.max(0, Math.round(economy))
  const sum = f + j + y
  if (sum > max && sum > 0) {
    f = Math.floor((f / sum) * max)
    j = Math.floor((j / sum) * max)
    y = max - f - j
  } else {
    f = Math.min(f, max)
    j = Math.min(j, max - f)
    y = max - f - j
  }
  return { density, economy: y, business: j, first: f }
}

/**
 * Adjust First or Business (Economy is the remainder so the cabin stays full).
 * Economy slider: grows by taking from Business, then First.
 */
export function setClassSeats(
  cabin: CabinConfig,
  baseCapacity: number,
  which: 'economy' | 'business' | 'first',
  value: number,
): CabinConfig {
  const max = maxSeatsFor(baseCapacity, cabin.density)
  let f = cabin.first
  let j = cabin.business
  const v = Math.max(0, Math.round(value))

  if (which === 'first') {
    f = Math.min(v, max)
    j = Math.min(j, max - f)
  } else if (which === 'business') {
    j = Math.min(v, max - f)
  } else {
    // Want this many economy seats → F+J = max - v
    const premiumBudget = Math.max(0, max - v)
    if (f + j > premiumBudget) {
      // shrink J first, then F
      const over = f + j - premiumBudget
      const takeJ = Math.min(j, over)
      j -= takeJ
      f = Math.max(0, f - (over - takeJ))
    }
  }
  const y = Math.max(0, max - f - j)
  return { density: cabin.density, economy: y, business: j, first: f }
}

export function totalSeats(cabin: CabinConfig): number {
  return cabin.economy + cabin.business + cabin.first
}

export function effectiveCapacity(plane: OwnedAircraft): number {
  if (plane.role === 'cargo') {
    const m = DENSITY[plane.cabin?.density ?? 'standard'].seatMult
    // Cargo: density slightly adjusts payload
    return Math.max(1, Math.round(plane.capacity * m))
  }
  if (plane.cabin) return totalSeats(plane.cabin)
  return plane.capacity
}

export function effectiveRangeKm(plane: OwnedAircraft): number {
  const d = plane.cabin?.density ?? 'standard'
  return Math.round(plane.rangeKm * DENSITY[d].rangeMult)
}

export function applyCabinDensity(
  cabin: CabinConfig,
  baseCapacity: number,
  density: CabinDensity,
): CabinConfig {
  const next = defaultCabin(baseCapacity, density)
  // Preserve class ratios from previous if possible
  const prevTotal = totalSeats(cabin) || 1
  const y = cabin.economy / prevTotal
  const j = cabin.business / prevTotal
  const f = cabin.first / prevTotal
  const seats = totalSeats(next)
  let first = Math.round(seats * f)
  let business = Math.round(seats * j)
  let economy = Math.round(seats * y)
  const drift = seats - (first + business + economy)
  economy = Math.max(0, economy + drift)
  return { density, economy, business, first }
}
