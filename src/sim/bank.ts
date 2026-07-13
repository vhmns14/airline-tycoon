/**
 * SkyBank — credit limit, loan products, daily interest.
 */

import type { Loan, OwnedAircraft } from '../types'
import { MS_PER_DAY } from './lease'

export type LoanProduct = {
  id: string
  label: string
  /** Suggested package amount (player may borrow up to max for product). */
  amount: number
  /** Interest per real day on remaining principal. */
  dailyRate: number
  /** Min reputation to unlock. */
  minRep: number
  blurb: string
}

/** Off-the-shelf loan packages (amount is max draw for that product). */
export const LOAN_PRODUCTS: LoanProduct[] = [
  {
    id: 'starter',
    label: 'Working capital',
    amount: 250_000,
    dailyRate: 0.0012, // ~0.12%/day
    minRep: 0,
    blurb: 'Small top-up · higher rate',
  },
  {
    id: 'growth',
    label: 'Fleet expansion',
    amount: 1_000_000,
    dailyRate: 0.0009,
    minRep: 40,
    blurb: 'Mid-size · standard rate',
  },
  {
    id: 'tycoon',
    label: 'Jumbo facility',
    amount: 5_000_000,
    dailyRate: 0.0007,
    minRep: 60,
    blurb: 'Big money · needs solid rep',
  },
  {
    id: 'emergency',
    label: 'Distress bridge',
    amount: 500_000,
    dailyRate: 0.002, // expensive
    minRep: 0,
    blurb: 'Expensive · when cash is tight',
  },
]

export const MAX_ACTIVE_LOANS = 4

export function fleetBookValue(fleet: OwnedAircraft[]): number {
  return fleet.reduce((s, p) => {
    // Leased planes don't count as collateral
    if (p.ownership === 'LEASED') return s
    return s + p.price * 0.55
  }, 0)
}

/**
 * Total credit line the bank will extend (sum of outstanding remaining
 * cannot exceed this).
 */
export function maxCreditLine(opts: {
  reputation: number
  peakCash: number
  cash: number
  fleet: OwnedAircraft[]
}): number {
  const { reputation, peakCash, cash, fleet } = opts
  const collateral = fleetBookValue(fleet)
  const repBoost = Math.max(0, reputation) * 12_000
  const peakBoost = peakCash * 0.2
  const base = 300_000
  // Healthy treasury slightly improves line
  const cashBoost = Math.max(0, cash) * 0.05
  return Math.round(base + repBoost + peakBoost + collateral + cashBoost)
}

export function totalDebt(loans: Loan[]): number {
  return loans.reduce((s, l) => s + l.remaining, 0)
}

export function availableCredit(
  loans: Loan[],
  maxLine: number,
): number {
  return Math.max(0, maxLine - totalDebt(loans))
}

export function annualizedPct(dailyRate: number): number {
  return dailyRate * 365 * 100
}

export type InterestTickResult = {
  loans: Loan[]
  interestCharged: number
}

/** Accrue daily interest on each loan; charge cash (caller deducts). */
export function applyLoanInterest(
  loans: Loan[],
  nowMs: number,
): InterestTickResult {
  let interestCharged = 0
  const next = loans.map((loan) => {
    if (loan.remaining <= 0) return loan
    const elapsed = nowMs - loan.lastInterestAt
    if (elapsed < MS_PER_DAY) return loan
    const days = Math.floor(elapsed / MS_PER_DAY)
    const interest = Math.round(loan.remaining * loan.dailyRate * days)
    interestCharged += interest
    return {
      ...loan,
      lastInterestAt: loan.lastInterestAt + days * MS_PER_DAY,
    }
  })
  return {
    loans: next.filter((l) => l.remaining > 0.5),
    interestCharged,
  }
}

export function makeLoan(
  product: LoanProduct,
  amount: number,
  nowMs: number,
): Loan {
  const principal = Math.round(amount)
  return {
    id: crypto.randomUUID(),
    principal,
    remaining: principal,
    dailyRate: product.dailyRate,
    takenAt: nowMs,
    lastInterestAt: nowMs,
    productId: product.id,
    label: product.label,
  }
}
