/**
 * Geographic helpers: distance, great-circle interpolation, bearing.
 */

import { clamp } from './math'

export type LatLng = {
  lat: number
  lng: number
}

const EARTH_RADIUS_KM = 6371

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180
}

function toDegrees(radians: number): number {
  return (radians * 180) / Math.PI
}

/**
 * Great-circle distance in kilometers between two lat/lng points (Haversine).
 */
export function haversineKm(a: LatLng, b: LatLng): number {
  const dLat = toRadians(b.lat - a.lat)
  const dLng = toRadians(b.lng - a.lng)

  const lat1 = toRadians(a.lat)
  const lat2 = toRadians(b.lat)

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)))
}

/**
 * Intermediate point on the great-circle path from `from` → `to`.
 * `fraction` is 0 at origin, 1 at destination (clamped).
 *
 * Uses the spherical intermediate-point formula:
 *   δ = distance / R
 *   a = sin((1-f)·δ) / sin δ
 *   b = sin(f·δ) / sin δ
 *   … then atan2 for φ, λ
 */
export function interpolateGreatCircle(
  from: LatLng,
  to: LatLng,
  fraction: number,
): LatLng {
  const f = clamp(fraction, 0, 1)
  if (f <= 0) return { lat: from.lat, lng: from.lng }
  if (f >= 1) return { lat: to.lat, lng: to.lng }

  const φ1 = toRadians(from.lat)
  const λ1 = toRadians(from.lng)
  const φ2 = toRadians(to.lat)
  const λ2 = toRadians(to.lng)

  const distance = haversineKm(from, to)
  const δ = distance / EARTH_RADIUS_KM

  // Coincident points (or near-zero arc)
  if (δ < 1e-12) {
    return { lat: from.lat, lng: from.lng }
  }

  const sinδ = Math.sin(δ)
  const a = Math.sin((1 - f) * δ) / sinδ
  const b = Math.sin(f * δ) / sinδ

  const x =
    a * Math.cos(φ1) * Math.cos(λ1) + b * Math.cos(φ2) * Math.cos(λ2)
  const y =
    a * Math.cos(φ1) * Math.sin(λ1) + b * Math.cos(φ2) * Math.sin(λ2)
  const z = a * Math.sin(φ1) + b * Math.sin(φ2)

  const φ = Math.atan2(z, Math.hypot(x, y))
  const λ = Math.atan2(y, x)

  return {
    lat: toDegrees(φ),
    lng: toDegrees(λ),
  }
}

/**
 * Initial bearing (forward azimuth) from `from` → `to`, in degrees [0, 360).
 * 0 = north, 90 = east — suitable for rotating a plane icon.
 */
export function bearing(from: LatLng, to: LatLng): number {
  const φ1 = toRadians(from.lat)
  const φ2 = toRadians(to.lat)
  const Δλ = toRadians(to.lng - from.lng)

  const y = Math.sin(Δλ) * Math.cos(φ2)
  const x =
    Math.cos(φ1) * Math.sin(φ2) -
    Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ)

  const θ = Math.atan2(y, x)
  return (toDegrees(θ) + 360) % 360
}
