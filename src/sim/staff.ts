/**
 * Crew requirements and payroll.
 */

import type { OwnedAircraft } from '../types'
import { MS_PER_DAY } from './lease'

export function requiredPilots(fleet: OwnedAircraft[]): number {
  return Math.max(0, fleet.length * 2)
}

export function requiredCabinCrew(fleet: OwnedAircraft[]): number {
  // Cargo needs fewer cabin staff
  return fleet.reduce((n, p) => n + (p.role === 'cargo' ? 1 : 3), 0)
}

export function staffDailyCost(pilots: number, cabinCrew: number): number {
  return pilots * 450 + cabinCrew * 220
}

export function staffCoverage(
  pilots: number,
  cabinCrew: number,
  fleet: OwnedAircraft[],
): { pilotRatio: number; crewRatio: number; understaffed: boolean } {
  const needP = requiredPilots(fleet)
  const needC = requiredCabinCrew(fleet)
  const pilotRatio = needP === 0 ? 1 : Math.min(1, pilots / needP)
  const crewRatio = needC === 0 ? 1 : Math.min(1, cabinCrew / needC)
  return {
    pilotRatio,
    crewRatio,
    understaffed: pilotRatio < 1 || crewRatio < 1,
  }
}

export type StaffChargeResult = {
  charged: number
  nextChargeAt: number
}

/** Charge payroll for each full real day elapsed. */
export function applyStaffCharges(
  pilots: number,
  cabinCrew: number,
  lastStaffChargeAt: number,
  now: number,
): StaffChargeResult {
  const elapsed = now - lastStaffChargeAt
  if (elapsed < MS_PER_DAY) {
    return { charged: 0, nextChargeAt: lastStaffChargeAt }
  }
  const days = Math.floor(elapsed / MS_PER_DAY)
  const charged = days * staffDailyCost(pilots, cabinCrew)
  return {
    charged,
    nextChargeAt: lastStaffChargeAt + days * MS_PER_DAY,
  }
}
