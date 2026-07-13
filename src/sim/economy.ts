/**
 * Per-leg economy with cabin classes, cargo RNG, events, rivals, reputation.
 */

import { odKey } from '../data/rivals'
import { airports } from '../data/airports'
import { haversineKm } from '../lib/geo'
import { clamp } from '../lib/math'
import type {
  GameEvent,
  OwnedAircraft,
  RivalAirline,
  Route,
} from '../types'
import { effectiveCapacity } from './cabin'
import {
  FLIGHT_TIME_SCALE,
  LEG_FUEL_COST_PER_L,
  REALTIME_COST_MULT,
  REALTIME_REVENUE_MULT,
} from './constants'
import { fuelLitersForDistance } from './fuel'

export type LegEconomyResult = {
  distanceKm: number
  flightDurationMs: number
  load: number
  role: 'passenger' | 'cargo'
  revenue: number
  fuelBurnLiters: number
  maintenanceCost: number
  cost: number
  profit: number
  demandFactor: number
  delayed: boolean
}

export function flightDurationMs(
  distanceKm: number,
  speedKmh: number,
  timeScale: number = FLIGHT_TIME_SCALE,
): number {
  if (speedKmh <= 0) return Number.POSITIVE_INFINITY
  // Real airborne time: distance/speed hours → ms, then optional scale
  // timeScale 1 = real-time; 30/60 = faster for casual play
  const realMs = (distanceKm / speedKmh) * 3_600_000
  const scaled = realMs / Math.max(0.001, timeScale)
  return Math.max(1_000, scaled)
}

export function fairPassengerPrice(distanceKm: number): number {
  // Base + per-km: short hops still pay (turnaround friction is real-time)
  // ~CGK–DPS (~1000 km) ≈ $280 fair Y before realtime mult
  return Math.max(42, 22 + distanceKm * 0.255)
}

export function fairCargoRate(distanceKm: number): number {
  // Per-tonne sector rate — map cargo multiplies on top
  return Math.max(48, 18 + distanceKm * 0.8)
}

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min)
}

function rivalPressure(
  fromId: string,
  toId: string,
  rivals: RivalAirline[],
): number {
  const key = odKey(fromId, toId)
  let n = 0
  for (const r of rivals) {
    if (r.routes.includes(key)) n += 1
  }
  // Each rival on the OD shaves ~8% demand
  return Math.max(0.55, 1 - n * 0.08)
}

export type SettleContext = {
  reputation: number
  event: GameEvent | null
  rivals: RivalAirline[]
  /** 0–1 staffing quality */
  staffFactor: number
  hubId: string | null
  /** Marketing + condition + secondary base bonuses already folded or partial. */
  marketingMult?: number
  conditionMult?: number
  /** Lounge facility demand (1 = none). */
  loungeMult?: number
  /** Secondary base on either end (mild demand). */
  baseNetworkMult?: number
  /** Alliance / codeshare demand mult. */
  allianceMult?: number
  /** Flight duration scale (1 real-time). */
  timeScale?: number
}

export function settleCompletedLeg(
  plane: OwnedAircraft,
  route: Route,
  fromId: string,
  toId: string,
  ctx: SettleContext,
): LegEconomyResult | null {
  const fromAirport = airports.find((a) => a.id === fromId)
  const toAirport = airports.find((a) => a.id === toId)
  if (!fromAirport || !toAirport) return null

  const distanceKm = haversineKm(fromAirport.coords, toAirport.coords)
  const durationMs = flightDurationMs(distanceKm, plane.speedKmh)
  const flightHours = durationMs / 3_600_000
  const role = plane.role ?? 'passenger'
  const cap = effectiveCapacity(plane)
  const freq = route.frequency ?? 1

  const eventDemand = ctx.event?.demandMult ?? 1
  const repFactor = 0.75 + (clamp(ctx.reputation, 0, 100) / 100) * 0.5
  const rival = rivalPressure(fromId, toId, ctx.rivals)
  const hubBonus =
    ctx.hubId && (fromId === ctx.hubId || toId === ctx.hubId) ? 1.08 : 1
  const mkt = ctx.marketingMult ?? 1
  const cond = ctx.conditionMult ?? 1
  const lounge = ctx.loungeMult ?? 1
  const baseNet = ctx.baseNetworkMult ?? 1
  const alliance = ctx.allianceMult ?? 1

  let load = 0
  let revenue = 0
  let demandFactor = 1

  if (role === 'cargo') {
    const fairRate = fairCargoRate(distanceKm)
    const baseDemand = (fromAirport.size + toAirport.size) * 4
    demandFactor =
      randomBetween(0.25, 1.45) *
      eventDemand *
      rival *
      hubBonus *
      lounge *
      baseNet *
      alliance *
      mkt *
      cond
    const priceFactor =
      fairRate > 0
        ? clamp(1 - (route.ticketPrice - fairRate) / fairRate, 0, 1.25)
        : 0
    load = Math.min(
      cap,
      Math.round(baseDemand * demandFactor * priceFactor * ctx.staffFactor),
    )
    // Frequency: more sectors → more freight moved (capped)
    load = Math.min(cap, Math.round(load * (0.7 + 0.3 * freq)))
    revenue = load * route.ticketPrice * freq
  } else {
    const fairPrice = fairPassengerPrice(distanceKm)
    const baseDemand = (fromAirport.size + toAirport.size) * 20
    demandFactor =
      randomBetween(0.85, 1.1) *
      eventDemand *
      rival *
      repFactor *
      hubBonus *
      lounge *
      baseNet *
      alliance *
      mkt *
      cond
    const priceFactor =
      fairPrice > 0
        ? clamp(1 - (route.ticketPrice - fairPrice) / fairPrice, 0, 1.2)
        : 0

    const cabin = plane.cabin
    if (cabin) {
      const yDemand = Math.round(
        baseDemand * demandFactor * priceFactor * 0.78 * ctx.staffFactor,
      )
      const jDemand = Math.round(
        baseDemand * demandFactor * 0.55 * 0.16 * ctx.staffFactor,
      )
      const fDemand = Math.round(
        baseDemand * demandFactor * 0.35 * 0.06 * ctx.staffFactor,
      )
      const y = Math.min(cabin.economy, yDemand)
      const j = Math.min(cabin.business, jDemand)
      const f = Math.min(cabin.first, fDemand)
      load = y + j + f
      const bp = route.businessPrice || route.ticketPrice * 2.2
      const fp = route.firstPrice || route.ticketPrice * 4.5
      revenue = (y * route.ticketPrice + j * bp + f * fp) * freq
    } else {
      load = Math.min(
        cap,
        Math.round(baseDemand * demandFactor * priceFactor * ctx.staffFactor),
      )
      revenue = load * route.ticketPrice * freq
    }
  }

  const fuelBurnLiters =
    fuelLitersForDistance(plane, distanceKm) * freq
  // Age: +0.5% maint per real day owned (cap +40%)
  const ageDays = Math.max(
    0,
    (Date.now() - (plane.acquiredAt ?? Date.now())) / (24 * 3600 * 1000),
  )
  const ageMult = Math.min(1.4, 1 + ageDays * 0.005)
  const maintenanceCost =
    plane.maintenancePerDay * (flightHours / 24) * ageMult * freq
  // Fuel already uplifted from stock; book a fair $/L so profit isn't pure revenue
  const fuelBookCost = fuelBurnLiters * LEG_FUEL_COST_PER_L

  const delayed = Math.random() < (ctx.event?.delayChance ?? 0)
  // Delay: slight revenue haircut + reputation handled by caller
  if (delayed) {
    revenue *= 0.92
  }

  // Real-time balance: fewer sectors → higher yield, slightly softer maint
  revenue = Math.round(revenue * REALTIME_REVENUE_MULT)
  const cost = Math.round(
    (maintenanceCost + fuelBookCost) * REALTIME_COST_MULT,
  )
  const profit = revenue - cost

  return {
    distanceKm,
    flightDurationMs: durationMs,
    load,
    role,
    revenue,
    fuelBurnLiters,
    maintenanceCost: Math.round(maintenanceCost * REALTIME_COST_MULT),
    cost,
    profit,
    demandFactor,
    delayed,
  }
}
