/**
 * Insurance, tax, investors, secondary bases, slot congestion.
 */

import type { Airport, OwnedAircraft, Route } from '../types'
import { MS_PER_DAY } from './lease'

// ─── Insurance ───────────────────────────────────────────────
export const INSURANCE_DAILY = 4_500

export function insurancePremiumDue(
  lastAt: number,
  now: number,
  on: boolean,
): { charge: number; nextAt: number } {
  if (!on) return { charge: 0, nextAt: lastAt }
  const elapsed = now - lastAt
  if (elapsed < MS_PER_DAY) return { charge: 0, nextAt: lastAt }
  const days = Math.floor(elapsed / MS_PER_DAY)
  return {
    charge: days * INSURANCE_DAILY,
    nextAt: lastAt + days * MS_PER_DAY,
  }
}

/** Multiplier on storm/event cash penalties when insured. */
export function insuranceLossMult(insured: boolean): number {
  return insured ? 0.35 : 1
}

// ─── Tax ─────────────────────────────────────────────────────
export const TAX_PERIOD_MS = 24 * 60 * 60 * 1000 // real day
export const TAX_RATE = 0.12 // 12% of period profit

export function computeTax(
  periodProfit: number,
  lastTaxAt: number,
  now: number,
): { tax: number; shouldReset: boolean } {
  if (now - lastTaxAt < TAX_PERIOD_MS) {
    return { tax: 0, shouldReset: false }
  }
  const tax = periodProfit > 0 ? Math.round(periodProfit * TAX_RATE) : 0
  return { tax, shouldReset: true }
}

// ─── Investors ───────────────────────────────────────────────
export const DIVIDEND_PERIOD_MS = 24 * 60 * 60 * 1000

/** Raise capital: cash in, permanent equity stake (max 35%). */
export function investorRaise(
  currentStake: number,
  raiseAmount: number,
  companyValue: number,
): { stake: number; ok: boolean } {
  if (raiseAmount < 100_000) return { stake: currentStake, ok: false }
  const value = Math.max(companyValue, 500_000)
  const addStake = (raiseAmount / value) * 100
  const stake = Math.min(35, currentStake + addStake)
  if (stake <= currentStake) return { stake: currentStake, ok: false }
  return { stake, ok: true }
}

export function estimateCompanyValue(
  cash: number,
  fleet: OwnedAircraft[],
  reputation: number,
): number {
  const fleetV = fleet
    .filter((p) => p.ownership === 'OWNED')
    .reduce((s, p) => s + p.price * 0.55 * (p.condition / 100), 0)
  return Math.round(cash + fleetV + reputation * 8_000)
}

export function dividendDue(
  stake: number,
  periodProfit: number,
  lastAt: number,
  now: number,
): { amount: number; nextAt: number } {
  if (stake <= 0 || now - lastAt < DIVIDEND_PERIOD_MS) {
    return { amount: 0, nextAt: lastAt }
  }
  const share = Math.max(0, periodProfit) * (stake / 100) * 0.4
  return {
    amount: Math.round(share),
    nextAt: now,
  }
}

// ─── Secondary bases ─────────────────────────────────────────
export function baseOpenFee(airport: Airport): number {
  return 40_000 + airport.size * 25_000
}

// ─── Slot congestion ─────────────────────────────────────────
/** More routes on same OD / busy airports → higher slot fee mult. */
export function congestionMult(
  fromId: string,
  toId: string,
  routes: Route[],
  rivals: { routes: string[] }[],
): number {
  const key = [fromId, toId].sort().join('|')
  const own = routes.filter((r) => {
    const k = [r.fromId, r.toId].sort().join('|')
    return k === key
  }).length
  let rival = 0
  for (const rv of rivals) {
    if (rv.routes.includes(key)) rival++
  }
  const pressure = own + rival * 0.6
  if (pressure <= 1) return 1
  if (pressure <= 2) return 1.15
  if (pressure <= 4) return 1.35
  return 1.55
}
