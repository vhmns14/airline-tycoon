/**
 * Fixed-term charter contracts — stable daily payouts.
 */

import type { ActiveContract, ContractKind } from '../types'
import { MS_PER_DAY } from './lease'

export type ContractOffer = {
  kind: ContractKind
  label: string
  days: number
  payoutPerDay: number
  unlockRep: number
}

export const CONTRACT_OFFERS: ContractOffer[] = [
  {
    kind: 'mail',
    label: 'National mail trunk',
    days: 14,
    payoutPerDay: 8_000,
    unlockRep: 0,
  },
  {
    kind: 'pax_charter',
    label: 'Gov. staff shuttle',
    days: 21,
    payoutPerDay: 22_000,
    unlockRep: 45,
  },
  {
    kind: 'cargo_charter',
    label: 'Mining FIFO cargo',
    days: 30,
    payoutPerDay: 35_000,
    unlockRep: 55,
  },
  {
    kind: 'pax_charter',
    label: 'Hajj prep charter',
    days: 28,
    payoutPerDay: 48_000,
    unlockRep: 70,
  },
]

export function startContract(
  offer: ContractOffer,
  now: number,
): ActiveContract {
  return {
    id: crypto.randomUUID(),
    kind: offer.kind,
    label: offer.label,
    payoutPerDay: offer.payoutPerDay,
    endsAt: now + offer.days * MS_PER_DAY,
    lastPayoutAt: now,
  }
}

export function tickContracts(
  contracts: ActiveContract[],
  now: number,
): { contracts: ActiveContract[]; payout: number; expired: string[] } {
  let payout = 0
  const expired: string[] = []
  const next: ActiveContract[] = []

  for (const c of contracts) {
    if (c.endsAt <= now) {
      expired.push(c.label)
      continue
    }
    const elapsed = now - c.lastPayoutAt
    if (elapsed >= MS_PER_DAY) {
      const days = Math.floor(elapsed / MS_PER_DAY)
      payout += days * c.payoutPerDay
      next.push({
        ...c,
        lastPayoutAt: c.lastPayoutAt + days * MS_PER_DAY,
      })
    } else {
      next.push(c)
    }
  }
  return { contracts: next, payout, expired }
}
