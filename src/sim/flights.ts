/**
 * Flight state machine — manual dispatch, park on arrival.
 *
 * - Player clicks Fly to depart (dispatch).
 * - On arrival: settle revenue, park IDLE at destination (ready for reverse).
 * - Offline: only finish the current leg (no infinite auto-turnaround).
 */

import { airports } from '../data/airports'
import { haversineKm } from '../lib/geo'
import type { FlightState, OwnedAircraft, Route } from '../types'
import {
  flightDurationMs,
  settleCompletedLeg,
  type SettleContext,
} from './economy'
import { fuelUpliftForDispatch } from './fuel'
import { isAog, wearFromLeg } from './maintenance'

export type LastLegSummary = {
  fromId: string
  toId: string
  load: number
  revenue: number
  profit: number
  delayed: boolean
}

export type FlightTickResult = {
  plane: OwnedAircraft
  profitDelta: number
  revenueDelta: number
  /** Full uplift deducted this tick (only if something was mid-flight — normally 0). */
  fuelBurned: number
  delays: number
  /** Populated when a leg just completed this tick. */
  lastLeg: LastLegSummary | null
}

export function startLeg(
  plane: OwnedAircraft,
  fromId: string,
  toId: string,
  departAt: number,
  timeScale = 1,
): FlightState {
  const from = airports.find((a) => a.id === fromId)
  const to = airports.find((a) => a.id === toId)
  const distanceKm =
    from && to ? haversineKm(from.coords, to.coords) : 0
  const duration = flightDurationMs(distanceKm, plane.speedKmh, timeScale)

  return {
    status: 'IN_FLIGHT',
    legFromId: fromId,
    legToId: toId,
    departAt,
    arriveAt: departAt + duration,
  }
}

/** Parked at `fromId`, next leg destination is `toId` (player must click Fly). */
export function groundedFlight(fromId: string, toId: string): FlightState {
  return {
    status: 'IDLE',
    legFromId: fromId,
    legToId: toId,
    departAt: 0,
    arriveAt: 0,
  }
}

/**
 * Gate departure on full fuel uplift for this leg.
 * Stock is deducted 100% at dispatch (caller subtracts `fuelBurned` once).
 */
export function tryDepart(
  plane: OwnedAircraft,
  fromId: string,
  toId: string,
  departAt: number,
  fuelStock: number,
  frequency: 1 | 2 | 3 = 1,
  /** e.g. fuel depot at origin → 0.92 */
  fuelMult = 1,
  timeScale = 1,
): { flight: FlightState; fuelBurned: number } | null {
  if (isAog(plane, departAt)) return null
  const base = fuelUpliftForDispatch(plane, fromId, toId, frequency)
  const uplift = Math.max(0, Math.round(base * Math.max(0.5, fuelMult)))
  if (uplift > 0 && fuelStock + 1e-9 < uplift) return null
  return {
    flight: startLeg(plane, fromId, toId, departAt, timeScale),
    fuelBurned: uplift,
  }
}

/**
 * Tick while airborne: complete at most ONE arrival per call when due.
 * Never auto-departs the next leg — plane parks until player dispatches.
 */
export function advanceAircraftFlight(
  plane: OwnedAircraft,
  route: Route,
  nowMs: number,
  _fuelStock: number,
  ctx: SettleContext,
): FlightTickResult {
  let working = plane
  if (working.aogUntil != null && working.aogUntil <= nowMs) {
    working = { ...working, aogUntil: null }
  }

  if (!working.flight) {
    return {
      plane: working,
      profitDelta: 0,
      revenueDelta: 0,
      fuelBurned: 0,
      delays: 0,
      lastLeg: null,
    }
  }

  // Weather: force park (player re-dispatches later)
  if (ctx.event?.groundAll && working.flight.status === 'IN_FLIGHT') {
    // Still allow in-air planes to finish when they arrive; only block new dispatch elsewhere
  }
  if (ctx.event?.groundAll && working.flight.status === 'IDLE') {
    return {
      plane: working,
      profitDelta: 0,
      revenueDelta: 0,
      fuelBurned: 0,
      delays: 1,
      lastLeg: null,
    }
  }

  // Parked — wait for player Fly click (or auto-fly handled by store)
  if (working.flight.status === 'IDLE') {
    return {
      plane: working,
      profitDelta: 0,
      revenueDelta: 0,
      fuelBurned: 0,
      delays: 0,
      lastLeg: null,
    }
  }

  // Still en route
  if (working.flight.status === 'IN_FLIGHT' && nowMs < working.flight.arriveAt) {
    return {
      plane: working,
      profitDelta: 0,
      revenueDelta: 0,
      fuelBurned: 0,
      delays: 0,
      lastLeg: null,
    }
  }

  // ── Arrival ────────────────────────────────────────────────
  // Process only the current leg that just finished (no chain while offline).
  // If many hours offline with one flight, still only ONE settle when they load.
  const flight = working.flight
  const completedFrom = flight.legFromId
  const completedTo = flight.legToId

  let profitDelta = 0
  let revenueDelta = 0
  let delays = 0
  let planeState = working
  let lastLeg: LastLegSummary | null = null

  const settlement = settleCompletedLeg(
    planeState,
    route,
    completedFrom,
    completedTo,
    { ...ctx, conditionMult: undefined },
  )
  if (settlement) {
    profitDelta += settlement.profit
    revenueDelta += settlement.revenue
    if (settlement.delayed) delays += 1
    lastLeg = {
      fromId: completedFrom,
      toId: completedTo,
      load: settlement.load,
      revenue: settlement.revenue,
      profit: settlement.profit,
      delayed: settlement.delayed,
    }
    const fromA = airports.find((a) => a.id === completedFrom)
    const toA = airports.find((a) => a.id === completedTo)
    const dist =
      fromA && toA ? haversineKm(fromA.coords, toA.coords) : 500
    planeState = wearFromLeg(planeState, dist, route.frequency ?? 1)
  }

  // Park at destination; next click Fly goes reverse (to → from)
  const parked = groundedFlight(completedTo, completedFrom)

  return {
    plane: { ...planeState, flight: parked },
    profitDelta,
    revenueDelta,
    fuelBurned: 0,
    delays,
    lastLeg,
  }
}

/** Whether this plane can be dispatched now (UI helper). */
export function canDispatch(
  plane: OwnedAircraft,
  route: Route | undefined,
  fuelStock: number,
  nowMs = Date.now(),
  groundAll = false,
): { ok: boolean; reason?: string } {
  if (!route) return { ok: false, reason: 'No route' }
  if (isAog(plane, nowMs)) return { ok: false, reason: 'AOG' }
  if (groundAll) return { ok: false, reason: 'Weather' }
  const flight = plane.flight
  if (!flight || flight.status !== 'IDLE') {
    return { ok: false, reason: flight?.status === 'IN_FLIGHT' ? 'In flight' : 'Not ready' }
  }
  const fromId = flight.legFromId || route.fromId
  const toId = flight.legToId || route.toId
  const uplift = fuelUpliftForDispatch(
    plane,
    fromId,
    toId,
    (route.frequency ?? 1) as 1 | 2 | 3,
  )
  if (uplift > fuelStock) {
    return { ok: false, reason: `Need ${Math.round(uplift)} L` }
  }
  return { ok: true }
}
