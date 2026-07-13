/**
 * Flight wall-clock scale helpers.
 */

import type { TimeScale } from '../types'

export const TIME_SCALE_OPTIONS: {
  id: TimeScale
  label: string
  blurb: string
}[] = [
  { id: 1, label: 'Real-time 1×', blurb: '1 real hour in air = 1 hour wait' },
  { id: 30, label: 'Fast 30×', blurb: '1 real hour ≈ 2 minutes' },
  { id: 60, label: 'Turbo 60×', blurb: '1 real hour ≈ 1 minute' },
]

export function clampTimeScale(v: unknown): TimeScale {
  if (v === 30 || v === 60 || v === 1) return v
  if (v === '30') return 30
  if (v === '60') return 60
  return 1
}
