/**
 * Daily lease billing for LEASED aircraft (real 24h wall-clock periods).
 */

import type { OwnedAircraft } from '../types'

export const MS_PER_DAY = 24 * 60 * 60 * 1000

export type LeaseChargeResult = {
  plane: OwnedAircraft
  /** Total cash deducted for this plane this refresh. */
  charged: number
}

/**
 * Charge full 24h periods elapsed since lastLeaseChargeAt.
 * Advances lastLeaseChargeAt by N days so offline catch-up is fair.
 */
export function applyLeaseCharges(
  plane: OwnedAircraft,
  nowMs: number,
): LeaseChargeResult {
  if (plane.ownership !== 'LEASED' || plane.lastLeaseChargeAt == null) {
    return { plane, charged: 0 }
  }

  const elapsed = nowMs - plane.lastLeaseChargeAt
  if (elapsed < MS_PER_DAY) {
    return { plane, charged: 0 }
  }

  const days = Math.floor(elapsed / MS_PER_DAY)
  const charged = days * plane.dailyLeaseCost
  const lastLeaseChargeAt = plane.lastLeaseChargeAt + days * MS_PER_DAY

  return {
    plane: { ...plane, lastLeaseChargeAt },
    charged,
  }
}
