/**
 * Hub / secondary base helpers: open fees, facilities, network roles.
 */

import type { Airport, HubFacilityId } from '../types'
import { baseOpenFee } from './ceo'

export type HubFacilityDef = {
  id: HubFacilityId
  label: string
  blurb: string
  cost: number
  /** Effect short label for UI */
  effect: string
}

export const HUB_FACILITIES: HubFacilityDef[] = [
  {
    id: 'fuel',
    label: 'Fuel depot',
    blurb: 'Cheaper uplift when departing this base.',
    cost: 75_000,
    effect: '−8% fuel uplift from here',
  },
  {
    id: 'lounge',
    label: 'Premium lounge',
    blurb: 'Higher demand on routes touching this base.',
    cost: 60_000,
    effect: '+6% demand via this base',
  },
  {
    id: 'mro',
    label: 'MRO hangar',
    blurb: 'Cheaper heavy checks while parked here.',
    cost: 90_000,
    effect: '−15% repair cost here',
  },
]

export function facilityDef(id: HubFacilityId): HubFacilityDef | undefined {
  return HUB_FACILITIES.find((f) => f.id === id)
}

export function hasFacility(
  facilities: Record<string, HubFacilityId[]> | undefined,
  airportId: string | null | undefined,
  id: HubFacilityId,
): boolean {
  if (!airportId || !facilities) return false
  return (facilities[airportId] ?? []).includes(id)
}

/** Demand mult when either end of a leg has a lounge. */
export function loungeDemandMult(
  facilities: Record<string, HubFacilityId[]> | undefined,
  fromId: string,
  toId: string,
): number {
  const a = hasFacility(facilities, fromId, 'lounge')
  const b = hasFacility(facilities, toId, 'lounge')
  if (a && b) return 1.1
  if (a || b) return 1.06
  return 1
}

/** Fuel uplift mult when departing from a fuel-depot base. */
export function fuelDepotMult(
  facilities: Record<string, HubFacilityId[]> | undefined,
  fromId: string,
): number {
  return hasFacility(facilities, fromId, 'fuel') ? 0.92 : 1
}

/** Repair cost mult when plane is parked at MRO base. */
export function mroRepairMult(
  facilities: Record<string, HubFacilityId[]> | undefined,
  parkedAtId: string | null | undefined,
): number {
  return hasFacility(facilities, parkedAtId, 'mro') ? 0.85 : 1
}

export function relocateHubFee(
  targetIsSecondaryBase: boolean,
  airport: Airport,
): number {
  if (targetIsSecondaryBase) return 12_000
  // Bigger airports cost more to establish as brand-new HQ
  return 25_000 + Math.max(0, airport.size - 3) * 8_000
}

export function closeBaseRefund(airport: Airport): number {
  return Math.round(baseOpenFee(airport) * 0.25)
}

export function promoteToHubFee(): number {
  return 8_000
}

export function isPlayerHub(
  airportId: string,
  hubId: string | null,
  secondaryBases: string[],
): boolean {
  return hubId === airportId || secondaryBases.includes(airportId)
}
