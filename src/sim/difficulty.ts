/**
 * Difficulty presets for new games.
 */

import type { Difficulty } from '../types'

export type DifficultyPreset = {
  id: Difficulty
  label: string
  cash: number
  fuel: number
  pilots: number
  cabinCrew: number
  hangarSlots: number
  reputation: number
  /** Multiplier on event spawn chance flavor */
  eventBias: number
  blurb: string
}

export const DIFFICULTY: Record<Difficulty, DifficultyPreset> = {
  easy: {
    id: 'easy',
    label: 'Easy',
    cash: 2_200_000,
    fuel: 22_000,
    pilots: 6,
    cabinCrew: 8,
    hangarSlots: 12,
    reputation: 60,
    eventBias: 0.7,
    blurb: 'More cash & fuel · gentler start',
  },
  normal: {
    id: 'normal',
    label: 'Normal',
    cash: 1_100_000,
    fuel: 10_000,
    pilots: 4,
    cabinCrew: 6,
    hangarSlots: 8,
    reputation: 55,
    eventBias: 1,
    blurb: 'Balanced CEO challenge',
  },
  hard: {
    id: 'hard',
    label: 'Hard',
    cash: 500_000,
    fuel: 4_000,
    pilots: 2,
    cabinCrew: 3,
    hangarSlots: 5,
    reputation: 45,
    eventBias: 1.35,
    blurb: 'Tight cash · lean crew · rough skies',
  },
}

export function hangarExpandCost(currentSlots: number): number {
  return 80_000 + Math.max(0, currentSlots - 5) * 45_000
}
