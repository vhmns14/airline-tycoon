/**
 * Second-hand / used aircraft listings — cheaper, worn condition.
 */

import { aircraft as catalog } from '../data/aircraft'
import type { Aircraft } from '../types'

export type UsedListing = {
  id: string
  catalogId: string
  model: string
  manufacturer: string
  role: Aircraft['role']
  /** Discounted buy price. */
  price: number
  condition: number
  /** Hours already on airframe (flavor). */
  hours: number
  bodyClass: Aircraft['bodyClass']
  imageKey: string
  minAirportSize: Aircraft['minAirportSize']
  capacity: number
  rangeKm: number
  speedKmh: number
  fuelCostPerKm: number
  maintenancePerDay: number
  dailyLeaseCost: number
}

export function generateUsedListings(now = Date.now(), count = 6): UsedListing[] {
  const pool = catalog.filter((a) => a.price < 25_000_000)
  const out: UsedListing[] = []
  for (let i = 0; i < count; i++) {
    const t = pool[Math.floor(Math.random() * pool.length)]
    if (!t) continue
    const wear = 0.55 + Math.random() * 0.35 // 55–90% of new price
    const condition = Math.round(42 + Math.random() * 45) // 42–87
    out.push({
      id: `used-${now}-${i}-${t.id}`,
      catalogId: t.id,
      model: `${t.model} (used)`,
      manufacturer: t.manufacturer,
      role: t.role,
      price: Math.round(t.price * wear * (condition / 100) * 1.05),
      condition,
      hours: Math.round(800 + Math.random() * 12_000),
      bodyClass: t.bodyClass,
      imageKey: t.imageKey,
      minAirportSize: t.minAirportSize,
      capacity: t.capacity,
      rangeKm: t.rangeKm,
      speedKmh: t.speedKmh,
      fuelCostPerKm: t.fuelCostPerKm * (1 + (100 - condition) * 0.002),
      maintenancePerDay: Math.round(
        t.maintenancePerDay * (1.1 + (100 - condition) * 0.008),
      ),
      dailyLeaseCost: Math.round(t.dailyLeaseCost * 0.75),
    })
  }
  return out
}
