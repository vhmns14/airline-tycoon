/**
 * Map-based cargo jobs: pick up at A, deliver at B for a lump sum.
 * Designed so light freighters (1–3 t) always see viable work.
 */

import { airports } from '../data/airports'
import { haversineKm } from '../lib/geo'
import type { ActiveContract, OwnedAircraft } from '../types'
import { fairCargoRate } from './economy'

const OFFER_TTL_MS = 60 * 60 * 1000 // 1h wall-clock
const MAX_ACTIVE_JOBS = 4
const MAX_OFFERS = 6

export type MapCargoLane = {
  fromId: string
  toId: string
  fromCode: string
  toCode: string
  fromCity: string
  toCity: string
  km: number
  tons: number
  payout: number
  /** true = accepted active job, false = open offer */
  active: boolean
  endsAt: number
  id: string
  label: string
}

function airportById(id: string) {
  return airports.find((a) => a.id === id)
}

/** Payload band weighted toward light freighters early game. */
function rollTons(): number {
  const r = Math.random()
  if (r < 0.42) return 1 + Math.floor(Math.random() * 3) // 1–3 t
  if (r < 0.78) return 4 + Math.floor(Math.random() * 7) // 4–10 t
  return 11 + Math.floor(Math.random() * 10) // 11–20 t
}

/** Prefer shorter regional hauls so real-time freighters can finish jobs. */
function rollDistanceOk(km: number): boolean {
  if (km < 180 || km > 3800) return false
  // Soft preference for ≤1800 km
  if (km > 1800 && Math.random() < 0.45) return false
  return true
}

export function generateMapCargoOffers(
  now: number,
  hubId: string | null,
  count = 4,
): ActiveContract[] {
  const pool = airports.filter((a) => a.size >= 2)
  if (pool.length < 2) return []

  const offers: ActiveContract[] = []
  let attempts = 0
  while (offers.length < count && attempts < count * 12) {
    attempts += 1
    const from =
      (hubId && Math.random() < 0.5
        ? airports.find((a) => a.id === hubId)
        : null) ?? pool[Math.floor(Math.random() * pool.length)]
    let to = pool[Math.floor(Math.random() * pool.length)]
    let guard = 0
    while (to.id === from.id && guard++ < 24) {
      to = pool[Math.floor(Math.random() * pool.length)]
    }
    if (to.id === from.id) continue

    const km = haversineKm(from.coords, to.coords)
    if (!rollDistanceOk(km)) continue

    const tons = rollTons()
    // Premium over regular freighter yield — map jobs are one-shot contracts
    const rate = fairCargoRate(km) * (1.25 + Math.random() * 0.4)
    const payout = Math.round(tons * rate * 2.2)

    offers.push({
      id: crypto.randomUUID(),
      kind: 'map_cargo',
      label: `Cargo ${from.code}→${to.code}`,
      payoutPerDay: 0,
      deliveryPayout: payout,
      fromId: from.id,
      toId: to.id,
      cargoTons: tons,
      endsAt: now + OFFER_TTL_MS,
      lastPayoutAt: now,
      delivered: false,
    })
  }
  return offers
}

export function refreshMapCargoOffers(
  offers: ActiveContract[],
  now: number,
  hubId: string | null,
): ActiveContract[] {
  const live = offers.filter(
    (o) => o.kind === 'map_cargo' && o.endsAt > now && !o.delivered,
  )
  if (live.length >= 4) return live.slice(0, MAX_OFFERS)
  return [
    ...live,
    ...generateMapCargoOffers(now, hubId, Math.max(2, 5 - live.length)),
  ].slice(0, MAX_OFFERS)
}

/** True if this completed leg fulfills an active map cargo job (OD + freighter). */
export function matchMapCargoDelivery(
  contracts: ActiveContract[],
  fromId: string,
  toId: string,
  plane?: OwnedAircraft,
): ActiveContract | null {
  return (
    contracts.find((c) => {
      if (c.kind !== 'map_cargo' || c.delivered) return false
      if (c.fromId !== fromId || c.toId !== toId) return false
      if (c.endsAt <= Date.now()) return false
      if (plane) {
        if (plane.role !== 'cargo') return false
        if (!freighterCanCarry(plane, c.cargoTons ?? 0)) return false
      }
      return true
    }) ?? null
  )
}

/** Capacity check: freighter tonnes ≥ job payload. */
export function freighterCanCarry(
  plane: OwnedAircraft,
  tons: number,
): boolean {
  if (plane.role !== 'cargo') return false
  const cap = plane.capacity ?? 0
  return cap + 1e-9 >= tons
}

/** Best freighter in fleet that can lift this job (or null). */
export function bestFreighterForJob(
  fleet: OwnedAircraft[],
  tons: number,
): OwnedAircraft | null {
  const ok = fleet
    .filter((p) => freighterCanCarry(p, tons))
    .sort((a, b) => a.capacity - b.capacity)
  return ok[0] ?? null
}

/** Where a plane is parked (null if airborne / unknown). */
export function planeLocationId(plane: OwnedAircraft): string | null {
  const f = plane.flight
  if (!f) return null
  if (f.status === 'IN_FLIGHT') return null
  return f.legFromId || null
}

export type FreighterPick = {
  plane: OwnedAircraft
  /** Can lift the job payload. */
  canCarry: boolean
  /** In the air right now. */
  inFlight: boolean
  /** Already assigned to a passenger/cargo route (will be reassigned). */
  hasRoute: boolean
  /** Parked airport id, if known. */
  locationId: string | null
  locationCode: string
  /** Already sitting at pickup airport. */
  atPickup: boolean
  /** Selectable for this job. */
  selectable: boolean
  reason?: string
}

/**
 * List freighters for the accept-job picker, best candidates first.
 */
export function freighterPicksForJob(
  fleet: OwnedAircraft[],
  routes: { aircraftInstanceId: string }[],
  tons: number,
  fromId: string,
  nowMs = Date.now(),
): FreighterPick[] {
  const routeSet = new Set(routes.map((r) => r.aircraftInstanceId))
  const picks: FreighterPick[] = []

  for (const plane of fleet) {
    if (plane.role !== 'cargo') continue
    const canCarry = freighterCanCarry(plane, tons)
    const inFlight = plane.flight?.status === 'IN_FLIGHT'
    const aog =
      plane.aogUntil != null && plane.aogUntil > nowMs
    const hasRoute = routeSet.has(plane.instanceId)
    const locationId = planeLocationId(plane)
    const locationCode =
      (locationId && airports.find((a) => a.id === locationId)?.code) ||
      (plane.flight == null ? 'Hangar' : '?')
    const atPickup = locationId === fromId

    let selectable = true
    let reason: string | undefined
    if (!canCarry) {
      selectable = false
      reason = `Need ≥${tons}t (has ${plane.capacity}t)`
    } else if (inFlight) {
      selectable = false
      reason = 'In flight'
    } else if (aog) {
      selectable = false
      reason = 'AOG / maintenance'
    } else if (hasRoute) {
      reason = 'Will leave current route'
    } else if (!atPickup && locationId) {
      reason = `Reposition ${locationCode}→pickup`
    } else if (!locationId) {
      reason = 'Position at pickup'
    }

    picks.push({
      plane,
      canCarry,
      inFlight,
      hasRoute,
      locationId,
      locationCode,
      atPickup,
      selectable,
      reason,
    })
  }

  // Prefer: can lift → free → at pickup → smallest capable freighter
  picks.sort((a, b) => {
    if (a.selectable !== b.selectable) return a.selectable ? -1 : 1
    if (a.atPickup !== b.atPickup) return a.atPickup ? -1 : 1
    if (a.hasRoute !== b.hasRoute) return a.hasRoute ? 1 : -1
    return a.plane.capacity - b.plane.capacity
  })
  return picks
}

export function maxActiveMapCargoJobs(): number {
  return MAX_ACTIVE_JOBS
}

/** Flatten offers + active contracts for map arcs / UI lists. */
export function mapCargoLanes(
  offers: ActiveContract[],
  contracts: ActiveContract[],
  now = Date.now(),
): MapCargoLane[] {
  const rows: MapCargoLane[] = []
  const push = (c: ActiveContract, active: boolean) => {
    if (c.kind !== 'map_cargo' || c.delivered || c.endsAt <= now) return
    if (!c.fromId || !c.toId) return
    const from = airportById(c.fromId)
    const to = airportById(c.toId)
    if (!from || !to) return
    rows.push({
      id: c.id,
      fromId: c.fromId,
      toId: c.toId,
      fromCode: from.code,
      toCode: to.code,
      fromCity: from.city,
      toCity: to.city,
      km: Math.round(haversineKm(from.coords, to.coords)),
      tons: c.cargoTons ?? 0,
      payout: c.deliveryPayout ?? 0,
      active,
      endsAt: c.endsAt,
      label: c.label,
    })
  }
  for (const c of contracts) push(c, true)
  for (const o of offers) push(o, false)
  return rows
}

export function formatCargoEta(endsAt: number, now = Date.now()): string {
  const ms = Math.max(0, endsAt - now)
  const m = Math.floor(ms / 60_000)
  if (m >= 60) {
    const h = Math.floor(m / 60)
    const rm = m % 60
    return `${h}h ${rm}m`
  }
  return `${m}m`
}
