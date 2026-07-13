/**
 * Helpers for merging local vs cloud game snapshots.
 * Prevents an empty/stale cloud save from wiping richer local progress.
 */

import type { GameState, OwnedAircraft, Route } from '../types'

export function progressScore(s: Partial<GameState> | null | undefined): number {
  if (!s) return 0
  const routes = s.routes?.length ?? 0
  const fleet = s.ownedAircraft?.length ?? 0
  const cash = Math.max(0, Number(s.cash) || 0)
  const founded = s.setupComplete ? 25 : 0
  return routes * 100 + fleet * 40 + founded + cash / 50_000
}

/**
 * True when cloud should replace local entirely.
 * False when local is clearly richer (e.g. cloud empty routes, local has network).
 */
export function shouldPreferLocalOverCloud(
  local: GameState,
  cloud: Partial<GameState>,
): boolean {
  if (!local.setupComplete) return false
  if (!cloud.setupComplete && local.setupComplete) return true

  const localRoutes = local.routes?.length ?? 0
  const cloudRoutes = Array.isArray(cloud.routes) ? cloud.routes.length : 0
  const localFleet = local.ownedAircraft?.length ?? 0
  const cloudFleet = Array.isArray(cloud.ownedAircraft)
    ? cloud.ownedAircraft.length
    : 0

  // Classic wipe: cloud has no network/fleet, local does
  if (localRoutes > 0 && cloudRoutes === 0) return true
  if (localFleet > 0 && cloudFleet === 0 && localRoutes >= cloudRoutes) {
    return true
  }

  // Local much richer overall
  const ls = progressScore(local)
  const cs = progressScore(cloud)
  if (ls >= cs + 80 && localRoutes >= cloudRoutes) return true

  return false
}

/** Union routes by id (cloud wins on id conflict). */
export function mergeRoutes(
  cloud: Route[] | undefined,
  local: Route[] | undefined,
): Route[] {
  const map = new Map<string, Route>()
  for (const r of cloud ?? []) {
    if (r?.id) map.set(r.id, r)
  }
  for (const r of local ?? []) {
    if (r?.id && !map.has(r.id)) map.set(r.id, r)
  }
  // Also avoid two routes on same plane — prefer cloud's assignment
  const byPlane = new Map<string, Route>()
  for (const r of map.values()) {
    const prev = byPlane.get(r.aircraftInstanceId)
    if (!prev) {
      byPlane.set(r.aircraftInstanceId, r)
      continue
    }
    // Prefer the one already in cloud list
    const cloudHas = (cloud ?? []).some((c) => c.id === r.id)
    const prevCloud = (cloud ?? []).some((c) => c.id === prev.id)
    byPlane.set(r.aircraftInstanceId, cloudHas || !prevCloud ? r : prev)
  }
  return [...byPlane.values()]
}

/** Union fleet by instanceId (cloud wins on conflict). */
export function mergeFleet(
  cloud: OwnedAircraft[] | undefined,
  local: OwnedAircraft[] | undefined,
): OwnedAircraft[] {
  const map = new Map<string, OwnedAircraft>()
  for (const a of local ?? []) {
    if (a?.instanceId) map.set(a.instanceId, a)
  }
  for (const a of cloud ?? []) {
    if (a?.instanceId) map.set(a.instanceId, a)
  }
  return [...map.values()]
}

/**
 * Build a cloud snapshot enriched with any local-only routes/planes
 * so a partial cloud save doesn't delete the network.
 */
export function enrichCloudWithLocal(
  cloud: Partial<GameState>,
  local: GameState,
): Partial<GameState> {
  const routes = mergeRoutes(cloud.routes, local.routes)
  const ownedAircraft = mergeFleet(cloud.ownedAircraft, local.ownedAircraft)
  return {
    ...cloud,
    routes,
    ownedAircraft,
    // Keep higher cash if local was ahead (don't lose admin gifts / profits)
    cash: Math.max(Number(cloud.cash) || 0, Number(local.cash) || 0),
    peakCash: Math.max(
      Number(cloud.peakCash) || 0,
      Number(local.peakCash) || 0,
      Number(cloud.cash) || 0,
      Number(local.cash) || 0,
    ),
    adminCashReceived: Math.max(
      Number(cloud.adminCashReceived) || 0,
      Number(local.adminCashReceived) || 0,
    ),
  }
}
