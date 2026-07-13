/**
 * Marketing campaigns boost demand for a wall-clock window.
 */

export type MarketingTier = {
  level: 1 | 2 | 3
  label: string
  cost: number
  durationMs: number
  demandMult: number
  repBoost: number
}

export const MARKETING_TIERS: MarketingTier[] = [
  {
    level: 1,
    label: 'Social blitz',
    cost: 25_000,
    durationMs: 45 * 60 * 1000,
    demandMult: 1.12,
    repBoost: 1,
  },
  {
    level: 2,
    label: 'TV + OOH',
    cost: 120_000,
    durationMs: 2 * 60 * 60 * 1000,
    demandMult: 1.25,
    repBoost: 3,
  },
  {
    level: 3,
    label: 'Global brand',
    cost: 400_000,
    durationMs: 4 * 60 * 60 * 1000,
    demandMult: 1.4,
    repBoost: 6,
  },
]

export function marketingDemandMult(
  marketingUntil: number,
  marketingLevel: number,
  now = Date.now(),
): number {
  if (marketingUntil <= now || marketingLevel <= 0) return 1
  const tier = MARKETING_TIERS.find((t) => t.level === marketingLevel)
  return tier?.demandMult ?? 1
}
