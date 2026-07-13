/**
 * Derived views over GameState (no store mutation).
 */

import { airports } from '../data/airports'
import { bearing, interpolateGreatCircle } from '../lib/geo'
import { clamp } from '../lib/math'
import type { GameState } from '../types'

/** Live map marker for an airborne aircraft. */
export type LiveAircraft = {
  instanceId: string
  model: string
  lat: number
  lng: number
  /** Degrees clockwise from north. */
  heading: number
  legFromId: string
  legToId: string
  /** 0 at departure, 1 at arrival. */
  progress: number
  arriveAt: number
}

/**
 * For each IN_FLIGHT aircraft, interpolate position along the great-circle leg
 * using wall-clock `nowMs` (defaults to Date.now()).
 *
 *   fraction = (now - departAt) / (arriveAt - departAt)  ∈ [0, 1]
 */
export function getLiveAircraft(
  state: GameState,
  nowMs: number = Date.now(),
): LiveAircraft[] {
  const { ownedAircraft } = state
  const result: LiveAircraft[] = []

  for (const plane of ownedAircraft) {
    const flight = plane.flight
    if (!flight || flight.status !== 'IN_FLIGHT') continue

    const fromAirport = airports.find((a) => a.id === flight.legFromId)
    const toAirport = airports.find((a) => a.id === flight.legToId)
    if (!fromAirport || !toAirport) continue

    const span = flight.arriveAt - flight.departAt
    const rawProgress =
      span > 0 ? (nowMs - flight.departAt) / span : 1
    const progress = clamp(rawProgress, 0, 1)

    const pos = interpolateGreatCircle(
      fromAirport.coords,
      toAirport.coords,
      progress,
    )
    const heading = bearing(fromAirport.coords, toAirport.coords)

    result.push({
      instanceId: plane.instanceId,
      model: plane.model,
      lat: pos.lat,
      lng: pos.lng,
      heading,
      legFromId: flight.legFromId,
      legToId: flight.legToId,
      progress,
      arriveAt: flight.arriveAt,
    })
  }

  return result
}
