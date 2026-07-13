/**
 * Random world events affecting fuel, demand, delays.
 */

import type { GameEvent, GameEventKind } from '../types'

const HOUR = 60 * 60 * 1000

type EventTemplate = {
  kind: GameEventKind
  title: string
  description: string
  durationMs: number
  fuelPriceMult: number
  demandMult: number
  delayChance: number
  weight: number
  groundAll?: boolean
}

const TEMPLATES: EventTemplate[] = [
  {
    kind: 'fuel_spike',
    title: 'Oil shock',
    description: 'Geopolitical tension — jet fuel market spikes.',
    durationMs: 2 * HOUR,
    fuelPriceMult: 1.55,
    demandMult: 0.95,
    delayChance: 0.05,
    weight: 2,
  },
  {
    kind: 'fuel_crash',
    title: 'Fuel glut',
    description: 'Surplus avtur — prices plunge for a while.',
    durationMs: 2 * HOUR,
    fuelPriceMult: 0.65,
    demandMult: 1.05,
    delayChance: 0,
    weight: 2,
  },
  {
    kind: 'storm',
    title: 'Regional storms',
    description: 'Weather systems delay departures; demand softens.',
    durationMs: 90 * 60 * 1000,
    fuelPriceMult: 1.05,
    demandMult: 0.8,
    delayChance: 0.35,
    weight: 3,
  },
  {
    kind: 'typhoon',
    title: 'Typhoon warning',
    description: 'Severe weather — most flights grounded.',
    durationMs: 60 * 60 * 1000,
    fuelPriceMult: 1.1,
    demandMult: 0.55,
    delayChance: 0.7,
    weight: 1,
    groundAll: true,
  },
  {
    kind: 'ash_cloud',
    title: 'Volcanic ash',
    description: 'Ash cloud — long-haul / high routes disrupted.',
    durationMs: 75 * 60 * 1000,
    fuelPriceMult: 1.05,
    demandMult: 0.7,
    delayChance: 0.5,
    weight: 1,
    groundAll: true,
  },
  {
    kind: 'fog',
    title: 'Dense fog',
    description: 'Low visibility at major hubs — holding patterns.',
    durationMs: 50 * 60 * 1000,
    fuelPriceMult: 1,
    demandMult: 0.9,
    delayChance: 0.45,
    weight: 2,
  },
  {
    kind: 'festival',
    title: 'Travel festival',
    description: 'Holiday rush — seats and cargo are hot.',
    durationMs: 3 * HOUR,
    fuelPriceMult: 1.1,
    demandMult: 1.35,
    delayChance: 0.1,
    weight: 2,
  },
  {
    kind: 'strike',
    title: 'ATC go-slow',
    description: 'Industrial action — delays and softer loads.',
    durationMs: 2 * HOUR,
    fuelPriceMult: 1,
    demandMult: 0.75,
    delayChance: 0.4,
    weight: 1,
  },
  {
    kind: 'boom',
    title: 'Business boom',
    description: 'Corporate travel & freight pick up strongly.',
    durationMs: 4 * HOUR,
    fuelPriceMult: 1.08,
    demandMult: 1.25,
    delayChance: 0,
    weight: 2,
  },
]

export const EVENT_COOLDOWN_MS = 45 * 60 * 1000 // 45 real minutes between events

export function maybeSpawnEvent(
  now: number,
  lastEventAt: number,
  active: GameEvent | null,
): GameEvent | null {
  if (active && active.endsAt > now) return active
  if (now - lastEventAt < EVENT_COOLDOWN_MS) return null
  // ~8% chance per refresh after cooldown once per minute effectively
  if (Math.random() > 0.02) return null

  const total = TEMPLATES.reduce((s, t) => s + t.weight, 0)
  let r = Math.random() * total
  let picked = TEMPLATES[0]
  for (const t of TEMPLATES) {
    r -= t.weight
    if (r <= 0) {
      picked = t
      break
    }
  }

  return {
    id: crypto.randomUUID(),
    kind: picked.kind,
    title: picked.title,
    description: picked.description,
    endsAt: now + picked.durationMs,
    fuelPriceMult: picked.fuelPriceMult,
    demandMult: picked.demandMult,
    delayChance: picked.delayChance,
    groundAll: picked.groundAll,
  }
}

export function eventExpired(ev: GameEvent | null, now: number): boolean {
  return !ev || ev.endsAt <= now
}
