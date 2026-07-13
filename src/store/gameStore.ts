/**
 * Master game store — branding, hub, fleet, fuel, staff, events, orders, finance.
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { aircraft as aircraftCatalog } from '../data/aircraft'
import { airports } from '../data/airports'
import { DEFAULT_RIVALS } from '../data/rivals'
import { haversineKm } from '../lib/geo'
import { localDayKey } from '../lib/time'
import { evaluateNewAchievements, ACHIEVEMENT_DEFS } from '../sim/achievements'
import { applyCabinDensity, defaultCabin } from '../sim/cabin'
import { slotFeeWithHub, validateRouteAirports } from '../sim/airportRules'
import { fairCargoRate } from '../sim/economy'
import { DIFFICULTY, hangarExpandCost } from '../sim/difficulty'
import { eventExpired, maybeSpawnEvent } from '../sim/events'
import {
  advanceAircraftFlight,
  groundedFlight,
  tryDepart,
} from '../sim/flights'
import { maybeExpandRivals } from '../sim/rivalsAi'
import { playSfx } from '../sim/sound'
import {
  DEFAULT_FUEL_CAPACITY,
  FUEL_PRICE_UPDATE_MS,
  fuelTankUpgradeCost,
  initialFuelPrice,
  nextFuelCapacity,
  rollFuelPrice,
} from '../sim/fuel'
import {
  availableCredit,
  LOAN_PRODUCTS,
  makeLoan,
  maxCreditLine,
  MAX_ACTIVE_LOANS,
  applyLoanInterest,
} from '../sim/bank'
import {
  baseOpenFee,
  computeTax,
  congestionMult,
  dividendDue,
  estimateCompanyValue,
  insurancePremiumDue,
  insuranceLossMult,
  investorRaise,
} from '../sim/ceo'
import {
  closeBaseRefund,
  facilityDef,
  fuelDepotMult,
  loungeDemandMult,
  mroRepairMult,
  promoteToHubFee,
  relocateHubFee,
} from '../sim/hubs'
import {
  CONTRACT_OFFERS,
  startContract,
  tickContracts,
} from '../sim/contracts'
import { applyLeaseCharges } from '../sim/lease'
import {
  applyRepair,
  defaultCondition,
  isAog,
  leaseReturnFee,
  repairCost,
  sellValue,
  conditionDemandMult,
} from '../sim/maintenance'
import { MARKETING_TIERS, marketingDemandMult } from '../sim/marketing'
import { applyStaffCharges, staffCoverage } from '../sim/staff'
import type {
  Branding,
  CabinConfig,
  CabinDensity,
  Difficulty,
  FinanceEntry,
  FlightLogEntry,
  FlightState,
  GameNotification,
  GameState,
  HubFacilityId,
  InsuranceClaim,
  Loan,
  OwnedAircraft,
  Route,
  TimeScale,
  WeeklyReport,
} from '../types'
import { clampTimeScale } from '../sim/timeScale'
import {
  freighterCanCarry,
  matchMapCargoDelivery,
  maxActiveMapCargoJobs,
  refreshMapCargoOffers,
} from '../sim/mapCargo'
import {
  createSeasonGoal,
  ensureSeasonGoal,
  scoreFromState,
  seasonComplete,
  seasonReward,
} from '../sim/season'
import { generateUsedListings, type UsedListing } from '../sim/usedMarket'

export const SAVE_KEY = 'airline-tycoon-save'

const MAX_LOG = 80
/** Aircraft order delivery delay (real time) — short for playability. */
export const ORDER_DELIVERY_MS = 8 * 60 * 1000 // 8 minutes

type GameActions = {
  completeSetup: (
    branding: Branding,
    hubId: string,
    difficulty?: Difficulty,
  ) => boolean
  updateBranding: (branding: Partial<Branding>) => void
  setHub: (hubId: string) => boolean

  buyAircraft: (
    aircraftId: string,
    cabin?: CabinConfig | null,
    /** Override catalog price (cabin-adjusted). */
    priceOverride?: number,
  ) => boolean
  leaseAircraft: (
    aircraftId: string,
    cabin?: CabinConfig | null,
    dailyLeaseOverride?: number,
  ) => boolean
  orderAircraft: (aircraftId: string) => boolean
  setCabinDensity: (instanceId: string, density: CabinDensity) => boolean
  /** Reconfigure Y/J/F on a parked passenger jet (fee applies if in service). */
  setCabinLayout: (instanceId: string, cabin: CabinConfig) => boolean

  hirePilots: (n: number) => boolean
  hireCabinCrew: (n: number) => boolean
  firePilots: (n: number) => void
  fireCabinCrew: (n: number) => void

  joinAlliance: () => boolean
  leaveAlliance: () => void

  buyFuel: (liters: number) => boolean
  openRoute: (
    aircraftInstanceId: string,
    fromId: string,
    toId: string,
    ticketPrice: number,
    businessPrice?: number,
    firstPrice?: number,
    frequency?: 1 | 2 | 3,
  ) => boolean
  removeRoute: (routeId: string) => void
  setRouteAutoFly: (routeId: string, on: boolean) => void
  /** Queue N auto legs (-1 = unlimited while auto). */
  setRouteSchedule: (routeId: string, legs: number) => void
  setTimeScale: (scale: TimeScale) => void
  /**
   * Manual dispatch: park → Fly. Takes full fuel uplift and starts leg.
   * Pass routeId or aircraft instanceId.
   */
  dispatchFlight: (routeIdOrInstanceId: string) => boolean
  /** Dispatch every parked aircraft that has a route and enough fuel. */
  dispatchAllParked: () => { launched: number; skipped: number }
  /** Borrow from SkyBank (product package, optional custom amount ≤ product). */
  takeLoan: (productId: string, amount?: number) => boolean
  repayLoan: (loanId: string, amount?: number) => boolean

  repairAircraft: (instanceId: string) => boolean
  sellAircraft: (instanceId: string) => boolean
  returnLease: (instanceId: string) => boolean
  openSecondaryBase: (airportId: string) => boolean
  closeSecondaryBase: (airportId: string) => boolean
  /** Make a secondary base the new home hub (old hub becomes secondary). */
  promoteBaseToHub: (airportId: string) => boolean
  buildHubFacility: (airportId: string, facility: HubFacilityId) => boolean
  expandHangar: () => boolean
  /** Expand shared fuel farm capacity (one step). */
  expandFuelTank: () => boolean
  runMarketing: (level: 1 | 2 | 3) => boolean
  setInsurance: (on: boolean) => boolean
  claimInsurance: (claimId: string) => boolean
  signContract: (offerIndex: number) => boolean
  /**
   * Accept map cargo job and assign a freighter (opens A→B route, parks at pickup).
   * `dispatchNow` starts the leg immediately if fuel allows.
   */
  acceptMapCargo: (
    offerId: string,
    aircraftInstanceId: string,
    dispatchNow?: boolean,
  ) => boolean
  buyUsedAircraft: (listingId: string) => boolean
  refreshUsedMarket: () => void
  claimSeasonReward: () => boolean
  upgradeAlliance: () => boolean
  raiseInvestorCapital: (amount: number) => boolean
  goPublic: () => boolean
  trainCrew: () => boolean
  toggleSound: () => void
  dismissNotification: (id: string) => void
  advanceTutorial: () => void
  skipTutorial: () => void

  refreshFlights: () => void
  newGame: () => void
}

/** Ephemeral used-market listings (regenerated, not fully persisted). */
let usedListingsCache: UsedListing[] = generateUsedListings()

export function getUsedListings(): UsedListing[] {
  return usedListingsCache
}

function emptyWeeklyReport(weekKey = ''): WeeklyReport {
  return {
    weekKey,
    revenue: 0,
    costs: 0,
    legs: 0,
    delayedLegs: 0,
    fuelBurned: 0,
  }
}

/** Monday date key for weekly rollup. */
function currentWeekKey(now: number): string {
  const d = new Date(now)
  const day = d.getDay() || 7
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - day + 1)
  return d.toISOString().slice(0, 10)
}

function pushNote(
  notes: GameNotification[],
  tone: GameNotification['tone'],
  text: string,
): GameNotification[] {
  const n: GameNotification = {
    id: crypto.randomUUID(),
    at: Date.now(),
    tone,
    text,
  }
  return [n, ...notes].slice(0, 8)
}

function nextFlightNumber(routes: Route[]): string {
  const n = 100 + (routes.length % 800) + Math.floor(Math.random() * 50)
  return `AT${n}`
}

export type GameStore = GameState & GameActions

const defaultBranding: Branding = {
  name: 'My Airline',
  slogan: 'Fly further',
  logoEmoji: '✈',
  primaryColor: '#c4a35a',
  secondaryColor: '#1c1916',
}

function pushLog(
  log: FinanceEntry[],
  entry: Omit<FinanceEntry, 'id'>,
): FinanceEntry[] {
  const next: FinanceEntry = { ...entry, id: crypto.randomUUID() }
  return [next, ...log].slice(0, MAX_LOG)
}

function createInitialState(): GameState {
  const now = Date.now()
  const preset = DIFFICULTY.normal
  const wk = currentWeekKey(now)
  return {
    branding: { ...defaultBranding },
    hubId: null,
    setupComplete: false,
    difficulty: 'normal',
    timeScale: 1,
    reputation: preset.reputation,
    allianceId: null,
    allianceLevel: 0,
    cash: preset.cash,
    peakCash: preset.cash,
    adminCashReceived: 0,
    todayRevenue: 0,
    todayCosts: 0,
    revenueDayKey: localDayKey(new Date(now)),
    gameStartedAtMs: now,
    financeLog: [],
    fuelStock: preset.fuel,
    fuelCapacity: DEFAULT_FUEL_CAPACITY,
    fuelPricePerLiter: initialFuelPrice(),
    lastFuelPriceAt: now,
    pilots: preset.pilots,
    cabinCrew: preset.cabinCrew,
    lastStaffChargeAt: now,
    crewTraining: 0,
    ownedAircraft: [],
    routes: [],
    pendingOrders: [],
    hangarSlots: preset.hangarSlots,
    loans: [],
    secondaryBases: [],
    hubFacilities: {},
    marketingUntil: 0,
    marketingLevel: 0,
    insuranceOn: false,
    lastInsuranceAt: now,
    insuranceClaims: [],
    lastTaxAt: now,
    taxPeriodProfit: 0,
    contracts: [],
    mapCargoOffers: refreshMapCargoOffers([], now, null),
    investorStake: 0,
    lastDividendAt: now,
    isPublic: false,
    seasonGoal: createSeasonGoal(wk),
    localScores: [],
    activeEvent: null,
    lastEventAt: now,
    rivals: DEFAULT_RIVALS,
    lastRivalTickAt: now,
    flightLog: [],
    weeklyReport: emptyWeeklyReport(wk),
    lastWeekKey: wk,
    achievements: [],
    soundEnabled: true,
    tutorialStep: 0,
    tutorialDone: false,
    notifications: [],
    gameOver: false,
  }
}

export const initialState: GameState = createInitialState()

function withCatalogDefaults(plane: OwnedAircraft): OwnedAircraft {
  const template = aircraftCatalog.find((a) => a.id === plane.id)
  const role = plane.role ?? template?.role ?? 'passenger'
  const now = Date.now()
  const cond = defaultCondition(now)
  return {
    ...plane,
    role,
    manufacturer:
      plane.manufacturer ?? template?.manufacturer ?? 'Unknown',
    bodyClass: plane.bodyClass ?? template?.bodyClass ?? 'narrowbody',
    imageKey: plane.imageKey ?? template?.imageKey ?? plane.id,
    minAirportSize: plane.minAirportSize ?? template?.minAirportSize ?? 1,
    dailyLeaseCost:
      plane.dailyLeaseCost ??
      template?.dailyLeaseCost ??
      Math.round((plane.price ?? 0) / 400),
    ownership: plane.ownership ?? 'OWNED',
    lastLeaseChargeAt:
      plane.ownership === 'LEASED'
        ? (plane.lastLeaseChargeAt ?? Date.now())
        : null,
    acquiredAt: plane.acquiredAt ?? Date.now(),
    cabin:
      role === 'passenger'
        ? (plane.cabin ??
          defaultCabin(template?.capacity ?? plane.capacity, 'standard'))
        : plane.cabin,
    condition: plane.condition ?? cond.condition,
    flightHours: plane.flightHours ?? 0,
    aogUntil: plane.aogUntil ?? null,
    lastMaintAt: plane.lastMaintAt ?? plane.acquiredAt ?? now,
  }
}

function normalizeFlight(
  raw: FlightState | null | undefined,
  _plane: OwnedAircraft,
  route: Route | undefined,
): FlightState | null {
  if (!route) return null
  if (!raw) return null
  if (
    typeof raw.departAt === 'number' &&
    typeof raw.arriveAt === 'number' &&
    raw.legFromId &&
    raw.legToId
  ) {
    if (raw.status === 'IDLE') return groundedFlight(raw.legFromId, raw.legToId)
    return {
      status: 'IN_FLIGHT',
      legFromId: raw.legFromId,
      legToId: raw.legToId,
      departAt: raw.departAt,
      arriveAt: raw.arriveAt,
    }
  }
  return groundedFlight(route.fromId, route.toId)
}

function normalizeRoute(r: Route): Route {
  return {
    ...r,
    businessPrice: r.businessPrice ?? Math.round(r.ticketPrice * 2.2),
    firstPrice: r.firstPrice ?? Math.round(r.ticketPrice * 4.5),
    frequency: r.frequency ?? 1,
    flightNumber: r.flightNumber ?? `AT${100 + Math.floor(Math.random() * 800)}`,
    autoFly: r.autoFly ?? false,
    scheduleLegsLeft: r.scheduleLegsLeft ?? 0,
  }
}

/** Snapshot of game data suitable for localStorage / cloud. */
export function serializeGameState(s: GameState): GameState {
  return {
    branding: s.branding,
    hubId: s.hubId,
    setupComplete: s.setupComplete,
    difficulty: s.difficulty,
    timeScale: s.timeScale,
    reputation: s.reputation,
    allianceId: s.allianceId,
    allianceLevel: s.allianceLevel,
    cash: s.cash,
    peakCash: s.peakCash,
    adminCashReceived: s.adminCashReceived ?? 0,
    todayRevenue: s.todayRevenue,
    todayCosts: s.todayCosts,
    revenueDayKey: s.revenueDayKey,
    gameStartedAtMs: s.gameStartedAtMs,
    financeLog: s.financeLog,
    fuelStock: s.fuelStock,
    fuelCapacity: s.fuelCapacity,
    fuelPricePerLiter: s.fuelPricePerLiter,
    lastFuelPriceAt: s.lastFuelPriceAt,
    pilots: s.pilots,
    cabinCrew: s.cabinCrew,
    lastStaffChargeAt: s.lastStaffChargeAt,
    ownedAircraft: s.ownedAircraft,
    routes: s.routes,
    pendingOrders: s.pendingOrders,
    hangarSlots: s.hangarSlots,
    loans: s.loans,
    secondaryBases: s.secondaryBases,
    hubFacilities: s.hubFacilities,
    marketingUntil: s.marketingUntil,
    marketingLevel: s.marketingLevel,
    insuranceOn: s.insuranceOn,
    lastInsuranceAt: s.lastInsuranceAt,
    insuranceClaims: s.insuranceClaims,
    lastTaxAt: s.lastTaxAt,
    taxPeriodProfit: s.taxPeriodProfit,
    contracts: s.contracts,
    mapCargoOffers: s.mapCargoOffers,
    investorStake: s.investorStake,
    lastDividendAt: s.lastDividendAt,
    isPublic: s.isPublic,
    seasonGoal: s.seasonGoal,
    localScores: s.localScores,
    activeEvent: s.activeEvent,
    lastEventAt: s.lastEventAt,
    rivals: s.rivals,
    lastRivalTickAt: s.lastRivalTickAt,
    flightLog: s.flightLog,
    weeklyReport: s.weeklyReport,
    lastWeekKey: s.lastWeekKey,
    achievements: s.achievements,
    soundEnabled: s.soundEnabled,
    tutorialStep: s.tutorialStep,
    tutorialDone: s.tutorialDone,
    notifications: s.notifications,
    gameOver: s.gameOver,
    crewTraining: s.crewTraining,
  }
}

/** Merge a saved partial into a full GameState (normalize fleet/routes). */
export function mergeGameState(
  persisted: Partial<GameState> | undefined,
  current: GameState,
): GameState {
  if (!persisted) return current
  const base = createInitialState()
  const fleet = (persisted.ownedAircraft ?? []).map((a) =>
    withCatalogDefaults(a as OwnedAircraft),
  )
  const routes = (persisted.routes ?? []).map((r) =>
    normalizeRoute(r as Route),
  )
  // Re-attach flight state consistency after load
  const routeByPlane = new Map(
    routes.map((r) => [r.aircraftInstanceId, r] as const),
  )
  const ownedAircraft = fleet.map((plane) => ({
    ...plane,
    flight: normalizeFlight(
      plane.flight,
      plane,
      routeByPlane.get(plane.instanceId),
    ),
  }))

  const wk = currentWeekKey(Date.now())
  return {
    ...base,
    ...current,
    ...persisted,
    branding: { ...base.branding, ...persisted.branding },
    difficulty: (persisted.difficulty as Difficulty | undefined) ?? 'normal',
    timeScale: clampTimeScale(persisted.timeScale),
    adminCashReceived:
      typeof persisted.adminCashReceived === 'number'
        ? persisted.adminCashReceived
        : (current.adminCashReceived ?? 0),
    hangarSlots: persisted.hangarSlots ?? base.hangarSlots,
    rivals: persisted.rivals?.length ? persisted.rivals : DEFAULT_RIVALS,
    lastRivalTickAt: persisted.lastRivalTickAt ?? Date.now(),
    financeLog: persisted.financeLog ?? [],
    pendingOrders: persisted.pendingOrders ?? [],
    loans: (persisted.loans as Loan[] | undefined) ?? [],
    secondaryBases: persisted.secondaryBases ?? [],
    hubFacilities: persisted.hubFacilities ?? {},
    marketingUntil: persisted.marketingUntil ?? 0,
    marketingLevel: (persisted.marketingLevel as 0 | 1 | 2 | 3) ?? 0,
    insuranceOn: persisted.insuranceOn ?? false,
    lastInsuranceAt: persisted.lastInsuranceAt ?? Date.now(),
    insuranceClaims:
      (persisted.insuranceClaims as InsuranceClaim[] | undefined) ?? [],
    lastTaxAt: persisted.lastTaxAt ?? Date.now(),
    taxPeriodProfit: persisted.taxPeriodProfit ?? 0,
    contracts: persisted.contracts ?? [],
    mapCargoOffers: persisted.mapCargoOffers ?? base.mapCargoOffers,
    investorStake: persisted.investorStake ?? 0,
    lastDividendAt: persisted.lastDividendAt ?? Date.now(),
    isPublic: persisted.isPublic ?? false,
    allianceLevel: (persisted.allianceLevel as 0 | 1 | 2 | undefined) ?? 0,
    seasonGoal: ensureSeasonGoal(persisted.seasonGoal, Date.now()),
    localScores: persisted.localScores ?? [],
    flightLog: (persisted.flightLog as FlightLogEntry[] | undefined) ?? [],
    weeklyReport: persisted.weeklyReport ?? emptyWeeklyReport(wk),
    lastWeekKey: persisted.lastWeekKey ?? wk,
    achievements: persisted.achievements ?? [],
    soundEnabled: persisted.soundEnabled ?? true,
    tutorialStep: persisted.tutorialStep ?? 0,
    tutorialDone: persisted.tutorialDone ?? false,
    notifications: persisted.notifications ?? [],
    crewTraining: persisted.crewTraining ?? 0,
    ownedAircraft,
    routes,
    setupComplete: persisted.setupComplete ?? false,
  }
}

export const useGameStore = create<GameStore>()(
  persist(
    (set, get) => ({
      ...createInitialState(),

      completeSetup: (branding, hubId, difficulty = 'normal') => {
        if (!airports.some((a) => a.id === hubId)) return false
        if (!branding.name.trim()) return false
        const preset = DIFFICULTY[difficulty] ?? DIFFICULTY.normal
        set({
          branding: {
            ...branding,
            name: branding.name.trim().slice(0, 40),
            slogan: branding.slogan.trim().slice(0, 60),
          },
          hubId,
          setupComplete: true,
          difficulty: preset.id,
          cash: preset.cash,
          peakCash: preset.cash,
          fuelStock: preset.fuel,
          pilots: preset.pilots,
          cabinCrew: preset.cabinCrew,
          hangarSlots: preset.hangarSlots,
          reputation: preset.reputation,
        })
        return true
      },

      updateBranding: (partial) => {
        set({ branding: { ...get().branding, ...partial } })
      },

      setHub: (hubId) => {
        if (get().gameOver) return false
        const ap = airports.find((a) => a.id === hubId)
        if (!ap) return false
        if (get().hubId === hubId) return false
        const s0 = get()
        const isSecondary = s0.secondaryBases.includes(hubId)
        const fee = relocateHubFee(isSecondary, ap)
        if (s0.cash < fee) return false
        const now = Date.now()
        const oldHub = s0.hubId
        set((s) => {
          let secondaryBases = s.secondaryBases.filter((id) => id !== hubId)
          // Keep old HQ as secondary base so network stays open
          if (oldHub && oldHub !== hubId && !secondaryBases.includes(oldHub)) {
            secondaryBases = [...secondaryBases, oldHub]
          }
          return {
            hubId,
            secondaryBases,
            cash: s.cash - fee,
            todayCosts: s.todayCosts + fee,
            financeLog: pushLog(s.financeLog, {
              at: now,
              kind: 'hub',
              label: `Relocate HQ → ${ap.code}`,
              amount: -fee,
            }),
            notifications: pushNote(
              s.notifications,
              'good',
              `Home hub is now ${ap.code} ${ap.city}`,
            ),
          }
        })
        return true
      },

      buyAircraft: (aircraftId, cabinLayout, priceOverride) => {
        if (get().gameOver || !get().setupComplete) return false
        const template = aircraftCatalog.find((a) => a.id === aircraftId)
        if (!template) return false
        const { cash, ownedAircraft, hangarSlots } = get()
        if (ownedAircraft.length >= hangarSlots) return false
        const price =
          typeof priceOverride === 'number' && priceOverride > 0
            ? Math.round(priceOverride)
            : template.price
        if (cash < price) return false
        const now = Date.now()
        const cabin =
          template.role === 'passenger'
            ? (cabinLayout ?? defaultCabin(template.capacity, 'standard'))
            : null
        const owned: OwnedAircraft = {
          ...template,
          price,
          instanceId: crypto.randomUUID(),
          ownership: 'OWNED',
          lastLeaseChargeAt: null,
          flight: null,
          acquiredAt: now,
          cabin,
          ...defaultCondition(now),
        }
        set((s) => ({
          cash: s.cash - price,
          ownedAircraft: [...s.ownedAircraft, owned],
          todayCosts: s.todayCosts + price,
          financeLog: pushLog(s.financeLog, {
            at: now,
            kind: 'other',
            label: `Buy ${template.model}`,
            amount: -price,
          }),
          notifications: pushNote(
            s.notifications,
            'good',
            `Acquired ${template.model}`,
          ),
        }))
        playSfx('money', get().soundEnabled)
        return true
      },

      leaseAircraft: (aircraftId, cabinLayout, dailyLeaseOverride) => {
        if (get().gameOver || !get().setupComplete) return false
        const template = aircraftCatalog.find((a) => a.id === aircraftId)
        if (!template) return false
        if (get().ownedAircraft.length >= get().hangarSlots) return false
        const now = Date.now()
        const dailyLeaseCost =
          typeof dailyLeaseOverride === 'number' && dailyLeaseOverride > 0
            ? Math.round(dailyLeaseOverride)
            : template.dailyLeaseCost
        const cabin =
          template.role === 'passenger'
            ? (cabinLayout ?? defaultCabin(template.capacity, 'standard'))
            : null
        const leased: OwnedAircraft = {
          ...template,
          dailyLeaseCost,
          instanceId: crypto.randomUUID(),
          ownership: 'LEASED',
          lastLeaseChargeAt: now,
          flight: null,
          acquiredAt: now,
          cabin,
          ...defaultCondition(now),
        }
        set((s) => ({
          ownedAircraft: [...s.ownedAircraft, leased],
          financeLog: pushLog(s.financeLog, {
            at: now,
            kind: 'lease',
            label: `Lease ${template.model}`,
            amount: 0,
          }),
        }))
        return true
      },

      orderAircraft: (aircraftId) => {
        if (get().gameOver || !get().setupComplete) return false
        const template = aircraftCatalog.find((a) => a.id === aircraftId)
        if (!template) return false
        // Reserve hangar for pending + fleet
        if (
          get().ownedAircraft.length + get().pendingOrders.length >=
          get().hangarSlots
        ) {
          return false
        }
        const deposit = Math.round(template.price * 0.3)
        if (get().cash < deposit) return false
        const now = Date.now()
        set((s) => ({
          cash: s.cash - deposit,
          todayCosts: s.todayCosts + deposit,
          pendingOrders: [
            ...s.pendingOrders,
            {
              id: crypto.randomUUID(),
              catalogId: template.id,
              model: template.model,
              role: template.role,
              deliverAt: now + ORDER_DELIVERY_MS,
              totalPrice: template.price,
              depositPaid: deposit,
            },
          ],
          financeLog: pushLog(s.financeLog, {
            at: now,
            kind: 'order',
            label: `Order deposit ${template.model}`,
            amount: -deposit,
          }),
        }))
        return true
      },

      setCabinDensity: (instanceId, density) => {
        const plane = get().ownedAircraft.find((a) => a.instanceId === instanceId)
        if (!plane || plane.role !== 'passenger' || !plane.cabin) return false
        // Can't reconfigure while flying
        if (plane.flight?.status === 'IN_FLIGHT') return false
        const cabin = applyCabinDensity(plane.cabin, plane.capacity, density)
        set((s) => ({
          ownedAircraft: s.ownedAircraft.map((a) =>
            a.instanceId === instanceId ? { ...a, cabin } : a,
          ),
        }))
        return true
      },

      setCabinLayout: (instanceId, cabin) => {
        const plane = get().ownedAircraft.find((a) => a.instanceId === instanceId)
        if (!plane || plane.role !== 'passenger') return false
        if (plane.flight?.status === 'IN_FLIGHT') return false
        // In-service reconfig fee (parked fleet)
        const fee = plane.flight ? 12_000 + Math.round(plane.capacity * 40) : 0
        if (fee > 0 && get().cash < fee) return false
        const now = Date.now()
        set((s) => ({
          cash: s.cash - fee,
          todayCosts: s.todayCosts + fee,
          ownedAircraft: s.ownedAircraft.map((a) =>
            a.instanceId === instanceId ? { ...a, cabin } : a,
          ),
          financeLog:
            fee > 0
              ? pushLog(s.financeLog, {
                  at: now,
                  kind: 'maintenance',
                  label: `Cabin reconfig ${plane.model}`,
                  amount: -fee,
                })
              : s.financeLog,
          notifications:
            fee > 0
              ? pushNote(
                  s.notifications,
                  'info',
                  `Cabin reconfigured on ${plane.model}`,
                )
              : s.notifications,
        }))
        return true
      },

      hirePilots: (n) => {
        if (n <= 0 || get().gameOver) return false
        const cost = n * 2_000
        if (get().cash < cost) return false
        set((s) => ({
          pilots: s.pilots + n,
          cash: s.cash - cost,
          todayCosts: s.todayCosts + cost,
          financeLog: pushLog(s.financeLog, {
            at: Date.now(),
            kind: 'staff',
            label: `Hire ${n} pilot(s)`,
            amount: -cost,
          }),
        }))
        return true
      },

      hireCabinCrew: (n) => {
        if (n <= 0 || get().gameOver) return false
        const cost = n * 800
        if (get().cash < cost) return false
        set((s) => ({
          cabinCrew: s.cabinCrew + n,
          cash: s.cash - cost,
          todayCosts: s.todayCosts + cost,
          financeLog: pushLog(s.financeLog, {
            at: Date.now(),
            kind: 'staff',
            label: `Hire ${n} cabin crew`,
            amount: -cost,
          }),
        }))
        return true
      },

      firePilots: (n) => {
        set((s) => ({
          pilots: Math.max(0, s.pilots - Math.max(0, n)),
        }))
      },

      fireCabinCrew: (n) => {
        set((s) => ({
          cabinCrew: Math.max(0, s.cabinCrew - Math.max(0, n)),
        }))
      },

      joinAlliance: () => {
        if (get().allianceId) return false
        const fee = 50_000
        if (get().cash < fee) return false
        set((s) => ({
          allianceId: 'sky-link',
          allianceLevel: 1,
          cash: s.cash - fee,
          reputation: Math.min(100, s.reputation + 5),
          todayCosts: s.todayCosts + fee,
          financeLog: pushLog(s.financeLog, {
            at: Date.now(),
            kind: 'other',
            label: 'Join SkyLink Alliance',
            amount: -fee,
          }),
        }))
        return true
      },

      leaveAlliance: () => {
        set({ allianceId: null, allianceLevel: 0 })
      },

      upgradeAlliance: () => {
        if (get().gameOver || !get().allianceId) return false
        const lvl = get().allianceLevel ?? 1
        if (lvl >= 2) return false
        const fee = 120_000
        if (get().cash < fee || get().reputation < 60) return false
        const now = Date.now()
        set((s) => ({
          allianceLevel: 2,
          cash: s.cash - fee,
          todayCosts: s.todayCosts + fee,
          reputation: Math.min(100, s.reputation + 4),
          financeLog: pushLog(s.financeLog, {
            at: now,
            kind: 'other',
            label: 'Codeshare upgrade (SkyLink)',
            amount: -fee,
          }),
          notifications: pushNote(
            s.notifications,
            'good',
            'Codeshare L2 — +demand & slot discount',
          ),
        }))
        return true
      },

      buyFuel: (liters) => {
        if (get().gameOver || liters <= 0) return false
        const { cash, fuelStock, fuelCapacity, fuelPricePerLiter, activeEvent } =
          get()
        const free = fuelCapacity - fuelStock
        if (free <= 0) return false
        const amount = Math.min(liters, free)
        const price =
          fuelPricePerLiter * (activeEvent?.fuelPriceMult ?? 1)
        const cost = amount * price
        if (cash < cost) return false
        set((s) => ({
          cash: s.cash - cost,
          fuelStock: s.fuelStock + amount,
          todayCosts: s.todayCosts + cost,
          financeLog: pushLog(s.financeLog, {
            at: Date.now(),
            kind: 'fuel',
            label: `Buy ${Math.round(amount)} L fuel`,
            amount: -cost,
          }),
        }))
        return true
      },

      openRoute: (
        aircraftInstanceId,
        fromId,
        toId,
        ticketPrice,
        businessPrice,
        firstPrice,
        frequency = 1,
      ) => {
        if (get().gameOver || !get().setupComplete) return false
        if (fromId === toId || ticketPrice <= 0) return false

        const state = get()
        const { ownedAircraft, routes, hubId, cash } = state
        const plane = ownedAircraft.find(
          (a) => a.instanceId === aircraftInstanceId,
        )
        // Must be free of active route; hangar plane may have null flight
        if (!plane) return false
        if (routes.some((r) => r.aircraftInstanceId === aircraftInstanceId)) {
          return false
        }
        if (plane.flight?.status === 'IN_FLIGHT') return false
        if (isAog(plane)) return false

        const from = airports.find((a) => a.id === fromId)
        const to = airports.find((a) => a.id === toId)
        if (!from || !to) return false

        // Origin must be hub or secondary base or already on network
        const network = new Set<string>([
          ...(hubId ? [hubId] : []),
          ...state.secondaryBases,
        ])
        for (const r of routes) {
          network.add(r.fromId)
          network.add(r.toId)
        }
        if (!network.has(fromId)) return false

        const distanceKm = haversineKm(from.coords, to.coords)
        const err = validateRouteAirports(plane, from, to, distanceKm)
        if (err) return false

        const cong = congestionMult(fromId, toId, routes, state.rivals)
        const aDisc =
          state.allianceId && (state.allianceLevel ?? 0) >= 2 ? 0.12 : 0
        const fee = slotFeeWithHub(from, to, hubId, cong, aDisc)
        if (cash < fee) return false

        const now = Date.now()
        const route: Route = {
          id: crypto.randomUUID(),
          aircraftInstanceId,
          fromId,
          toId,
          ticketPrice,
          businessPrice:
            businessPrice ?? Math.round(ticketPrice * 2.2),
          firstPrice: firstPrice ?? Math.round(ticketPrice * 4.5),
          frequency: frequency,
          flightNumber: nextFlightNumber(routes),
          autoFly: false,
          scheduleLegsLeft: 0,
        }

        // Park at origin — player must click Fly to depart (no offline spam legs)
        const flight = groundedFlight(fromId, toId)

        set((s) => ({
          cash: s.cash - fee,
          todayCosts: s.todayCosts + fee,
          routes: [...s.routes, route],
          ownedAircraft: s.ownedAircraft.map((a) =>
            a.instanceId === aircraftInstanceId ? { ...a, flight } : a,
          ),
          financeLog: pushLog(s.financeLog, {
            at: now,
            kind: 'slot',
            label: `Slot fees ${from.code}–${to.code}`,
            amount: -fee,
          }),
          notifications: pushNote(
            s.notifications,
            'info',
            `${route.flightNumber} ready at ${from.code} — click Fly to depart`,
          ),
        }))
        return true
      },

      removeRoute: (routeId) => {
        if (get().gameOver) return
        const { routes, ownedAircraft } = get()
        const route = routes.find((r) => r.id === routeId)
        if (!route) return
        set({
          routes: routes.filter((r) => r.id !== routeId),
          ownedAircraft: ownedAircraft.map((a) =>
            a.instanceId === route.aircraftInstanceId
              ? { ...a, flight: null }
              : a,
          ),
        })
      },

      setRouteAutoFly: (routeId, on) => {
        if (get().gameOver) return
        set((s) => ({
          routes: s.routes.map((r) =>
            r.id === routeId ? { ...r, autoFly: on } : r,
          ),
          notifications: on
            ? pushNote(
                s.notifications,
                'info',
                'Auto-fly enabled — plane departs when parked',
              )
            : s.notifications,
        }))
        if (on) playSfx('click', get().soundEnabled)
      },

      setRouteSchedule: (routeId, legs) => {
        if (get().gameOver) return
        const n = legs === -1 ? -1 : Math.max(0, Math.min(99, Math.round(legs)))
        set((s) => ({
          routes: s.routes.map((r) =>
            r.id === routeId
              ? {
                  ...r,
                  scheduleLegsLeft: n,
                  autoFly: n !== 0 ? true : r.autoFly,
                }
              : r,
          ),
          notifications: pushNote(
            s.notifications,
            'info',
            n === 0
              ? 'Schedule cleared'
              : n === -1
                ? 'Schedule: unlimited auto legs'
                : `Schedule: ${n} auto legs queued`,
          ),
        }))
      },

      setTimeScale: (scale) => {
        set({ timeScale: clampTimeScale(scale) })
        playSfx('click', get().soundEnabled)
      },

      dispatchFlight: (routeIdOrInstanceId) => {
        if (get().gameOver || !get().setupComplete) return false
        const state = get()
        const route =
          state.routes.find((r) => r.id === routeIdOrInstanceId) ??
          state.routes.find(
            (r) => r.aircraftInstanceId === routeIdOrInstanceId,
          )
        if (!route) return false
        const plane = state.ownedAircraft.find(
          (a) => a.instanceId === route.aircraftInstanceId,
        )
        if (!plane) return false
        if (isAog(plane)) return false
        if (state.activeEvent?.groundAll) return false

        const flight = plane.flight
        // Must be parked (IDLE). If null, seed from route origin.
        const fromId =
          flight?.status === 'IDLE'
            ? flight.legFromId || route.fromId
            : flight?.status === 'IN_FLIGHT'
              ? '' // cannot dispatch while airborne
              : route.fromId
        const toId =
          flight?.status === 'IDLE'
            ? flight.legToId || route.toId
            : route.toId

        if (!fromId || flight?.status === 'IN_FLIGHT') return false

        const now = Date.now()
        const freq = (route.frequency ?? 1) as 1 | 2 | 3
        const fMult = fuelDepotMult(state.hubFacilities, fromId)
        const scale = state.timeScale ?? 1
        const dep = tryDepart(
          plane,
          fromId,
          toId,
          now,
          state.fuelStock,
          freq,
          fMult,
          scale,
        )
        if (!dep) return false

        const fromAp = airports.find((a) => a.id === fromId)
        const toAp = airports.find((a) => a.id === toId)

        set((s) => ({
          fuelStock: Math.max(0, s.fuelStock - dep.fuelBurned),
          ownedAircraft: s.ownedAircraft.map((a) =>
            a.instanceId === plane.instanceId
              ? { ...a, flight: dep.flight }
              : a,
          ),
          notifications: pushNote(
            s.notifications,
            'good',
            `${route.flightNumber} departed ${fromAp?.code ?? '?'}→${toAp?.code ?? '?'} (−${Math.round(dep.fuelBurned)} L)`,
          ),
        }))
        playSfx('depart', get().soundEnabled)
        return true
      },

      dispatchAllParked: () => {
        if (get().gameOver || !get().setupComplete) {
          return { launched: 0, skipped: 0 }
        }
        const state = get()
        if (state.activeEvent?.groundAll) {
          set((s) => ({
            notifications: pushNote(
              s.notifications,
              'warn',
              'Weather holds all departures',
            ),
          }))
          return { launched: 0, skipped: state.routes.length }
        }

        let fuel = state.fuelStock
        let fleet = state.ownedAircraft.map((a) => ({ ...a }))
        let launched = 0
        let skipped = 0
        const now = Date.now()
        const notes: string[] = []

        // Stable order: by flight number then model
        const readyRoutes = [...state.routes].sort((a, b) =>
          (a.flightNumber ?? '').localeCompare(b.flightNumber ?? ''),
        )

        for (const route of readyRoutes) {
          const idx = fleet.findIndex(
            (a) => a.instanceId === route.aircraftInstanceId,
          )
          if (idx < 0) {
            skipped++
            continue
          }
          const plane = fleet[idx]
          if (isAog(plane, now)) {
            skipped++
            continue
          }
          const flight = plane.flight
          if (!flight || flight.status !== 'IDLE') {
            skipped++
            continue
          }
          const fromId = flight.legFromId || route.fromId
          const toId = flight.legToId || route.toId
          const freq = (route.frequency ?? 1) as 1 | 2 | 3
          const fMult = fuelDepotMult(state.hubFacilities, fromId)
          const dep = tryDepart(
            plane,
            fromId,
            toId,
            now,
            fuel,
            freq,
            fMult,
            state.timeScale ?? 1,
          )
          if (!dep) {
            skipped++
            continue
          }
          fuel = Math.max(0, fuel - dep.fuelBurned)
          fleet[idx] = { ...plane, flight: dep.flight }
          launched++
          const fromAp = airports.find((a) => a.id === fromId)
          const toAp = airports.find((a) => a.id === toId)
          notes.push(
            `${route.flightNumber} ${fromAp?.code ?? '?'}→${toAp?.code ?? '?'}`,
          )
        }

        if (launched === 0) {
          set((s) => ({
            notifications: pushNote(
              s.notifications,
              'warn',
              skipped > 0
                ? 'No departures — fuel, weather, or nothing parked'
                : 'No parked aircraft ready to fly',
            ),
          }))
          return { launched: 0, skipped }
        }

        set((s) => ({
          fuelStock: fuel,
          ownedAircraft: fleet,
          notifications: pushNote(
            s.notifications,
            'good',
            `Fly all: ${launched} departed` +
              (skipped ? ` · ${skipped} held` : '') +
              (notes.length <= 3 ? ` (${notes.join(', ')})` : ''),
          ),
        }))
        return { launched, skipped }
      },

      takeLoan: (productId, amount) => {
        if (get().gameOver || !get().setupComplete) return false
        const state = get()
        const product = LOAN_PRODUCTS.find((p) => p.id === productId)
        if (!product) return false
        if (state.reputation < product.minRep) return false
        if (state.loans.length >= MAX_ACTIVE_LOANS) return false

        const draw = Math.round(
          Math.min(amount ?? product.amount, product.amount),
        )
        if (draw < 10_000) return false

        const maxLine = maxCreditLine({
          reputation: state.reputation,
          peakCash: state.peakCash,
          cash: state.cash,
          fleet: state.ownedAircraft,
        })
        const room = availableCredit(state.loans, maxLine)
        if (draw > room) return false

        const now = Date.now()
        const loan = makeLoan(product, draw, now)
        set((s) => ({
          cash: s.cash + draw,
          peakCash: Math.max(s.peakCash, s.cash + draw),
          loans: [...s.loans, loan],
          financeLog: pushLog(s.financeLog, {
            at: now,
            kind: 'loan',
            label: `Loan: ${product.label}`,
            amount: draw,
          }),
        }))
        return true
      },

      repayLoan: (loanId, amount) => {
        if (get().gameOver || !get().setupComplete) return false
        const state = get()
        const loan = state.loans.find((l) => l.id === loanId)
        if (!loan) return false

        const want = amount == null ? loan.remaining : Math.round(amount)
        if (want <= 0) return false
        const pay = Math.min(want, loan.remaining, state.cash)
        if (pay <= 0) return false

        const now = Date.now()
        const remaining = loan.remaining - pay
        set((s) => ({
          cash: s.cash - pay,
          todayCosts: s.todayCosts + pay,
          loans:
            remaining < 1
              ? s.loans.filter((l) => l.id !== loanId)
              : s.loans.map((l) =>
                  l.id === loanId ? { ...l, remaining } : l,
                ),
          financeLog: pushLog(s.financeLog, {
            at: now,
            kind: 'loan',
            label:
              remaining < 1
                ? `Repaid loan in full (${loan.label})`
                : `Loan repayment (${loan.label})`,
            amount: -pay,
          }),
        }))
        return true
      },

      repairAircraft: (instanceId) => {
        if (get().gameOver || !get().setupComplete) return false
        const plane = get().ownedAircraft.find((a) => a.instanceId === instanceId)
        if (!plane) return false
        const parkedAt =
          plane.flight?.status === 'IDLE' ? plane.flight.legFromId : null
        const mult = mroRepairMult(get().hubFacilities, parkedAt)
        const cost = Math.round(repairCost(plane) * mult)
        if (cost <= 0) return false
        if (get().cash < cost) return false
        const now = Date.now()
        set((s) => ({
          cash: s.cash - cost,
          todayCosts: s.todayCosts + cost,
          ownedAircraft: s.ownedAircraft.map((a) =>
            a.instanceId === instanceId ? applyRepair(a, now) : a,
          ),
          financeLog: pushLog(s.financeLog, {
            at: now,
            kind: 'maintenance',
            label: `Heavy check ${plane.model}${mult < 1 ? ' (MRO)' : ''}`,
            amount: -cost,
          }),
          notifications: pushNote(
            s.notifications,
            'good',
            `${plane.model} returned to service`,
          ),
        }))
        return true
      },

      sellAircraft: (instanceId) => {
        if (get().gameOver || !get().setupComplete) return false
        const s0 = get()
        const plane = s0.ownedAircraft.find((a) => a.instanceId === instanceId)
        if (!plane || plane.ownership !== 'OWNED') return false
        if (s0.routes.some((r) => r.aircraftInstanceId === instanceId)) {
          return false
        }
        const value = sellValue(plane)
        const now = Date.now()
        set((s) => ({
          cash: s.cash + value,
          peakCash: Math.max(s.peakCash, s.cash + value),
          ownedAircraft: s.ownedAircraft.filter(
            (a) => a.instanceId !== instanceId,
          ),
          financeLog: pushLog(s.financeLog, {
            at: now,
            kind: 'sell',
            label: `Sold ${plane.model}`,
            amount: value,
          }),
          notifications: pushNote(
            s.notifications,
            'info',
            `Sold ${plane.model} for ${value.toLocaleString()}`,
          ),
        }))
        return true
      },

      returnLease: (instanceId) => {
        if (get().gameOver || !get().setupComplete) return false
        const s0 = get()
        const plane = s0.ownedAircraft.find((a) => a.instanceId === instanceId)
        if (!plane || plane.ownership !== 'LEASED') return false
        if (s0.routes.some((r) => r.aircraftInstanceId === instanceId)) {
          return false
        }
        const fee = leaseReturnFee(plane)
        if (s0.cash < fee) return false
        const now = Date.now()
        set((s) => ({
          cash: s.cash - fee,
          todayCosts: s.todayCosts + fee,
          ownedAircraft: s.ownedAircraft.filter(
            (a) => a.instanceId !== instanceId,
          ),
          financeLog: pushLog(s.financeLog, {
            at: now,
            kind: 'lease',
            label: `Lease return ${plane.model}`,
            amount: -fee,
          }),
        }))
        return true
      },

      openSecondaryBase: (airportId) => {
        if (get().gameOver || !get().setupComplete) return false
        const s0 = get()
        if (s0.hubId === airportId) return false
        if (s0.secondaryBases.includes(airportId)) return false
        const ap = airports.find((a) => a.id === airportId)
        if (!ap) return false
        const fee = baseOpenFee(ap)
        if (s0.cash < fee) return false
        const now = Date.now()
        set((s) => ({
          cash: s.cash - fee,
          todayCosts: s.todayCosts + fee,
          secondaryBases: [...s.secondaryBases, airportId],
          financeLog: pushLog(s.financeLog, {
            at: now,
            kind: 'hub',
            label: `Open base ${ap.code}`,
            amount: -fee,
          }),
          notifications: pushNote(
            s.notifications,
            'good',
            `Secondary base ${ap.code} open`,
          ),
        }))
        return true
      },

      closeSecondaryBase: (airportId) => {
        if (get().gameOver || !get().setupComplete) return false
        const s0 = get()
        if (!s0.secondaryBases.includes(airportId)) return false
        const ap = airports.find((a) => a.id === airportId)
        if (!ap) return false
        // Planes still assigned on routes touching this base is OK
        // (network keeps them via route OD). Just close the outpost.
        const refund = closeBaseRefund(ap)
        const now = Date.now()
        set((s) => {
          const { [airportId]: _removed, ...restFac } = s.hubFacilities ?? {}
          void _removed
          return {
            cash: s.cash + refund,
            secondaryBases: s.secondaryBases.filter((id) => id !== airportId),
            hubFacilities: restFac,
            financeLog: pushLog(s.financeLog, {
              at: now,
              kind: 'hub',
              label: `Close base ${ap.code} (refund)`,
              amount: refund,
            }),
            notifications: pushNote(
              s.notifications,
              'info',
              `Closed base ${ap.code} · refund ${refund.toLocaleString()}`,
            ),
          }
        })
        return true
      },

      promoteBaseToHub: (airportId) => {
        if (get().gameOver || !get().setupComplete) return false
        const s0 = get()
        if (!s0.secondaryBases.includes(airportId)) return false
        if (s0.hubId === airportId) return false
        const ap = airports.find((a) => a.id === airportId)
        if (!ap) return false
        const fee = promoteToHubFee()
        if (s0.cash < fee) return false
        const oldHub = s0.hubId
        const now = Date.now()
        set((s) => {
          let secondaryBases = s.secondaryBases.filter((id) => id !== airportId)
          if (oldHub && !secondaryBases.includes(oldHub)) {
            secondaryBases = [...secondaryBases, oldHub]
          }
          return {
            hubId: airportId,
            secondaryBases,
            cash: s.cash - fee,
            todayCosts: s.todayCosts + fee,
            financeLog: pushLog(s.financeLog, {
              at: now,
              kind: 'hub',
              label: `Promote ${ap.code} → home hub`,
              amount: -fee,
            }),
            notifications: pushNote(
              s.notifications,
              'good',
              `${ap.code} is now home hub`,
            ),
          }
        })
        return true
      },

      buildHubFacility: (airportId, facility) => {
        if (get().gameOver || !get().setupComplete) return false
        const s0 = get()
        const isOurs =
          s0.hubId === airportId || s0.secondaryBases.includes(airportId)
        if (!isOurs) return false
        const def = facilityDef(facility)
        if (!def) return false
        const existing = s0.hubFacilities?.[airportId] ?? []
        if (existing.includes(facility)) return false
        if (s0.cash < def.cost) return false
        const now = Date.now()
        const ap = airports.find((a) => a.id === airportId)
        set((s) => ({
          cash: s.cash - def.cost,
          todayCosts: s.todayCosts + def.cost,
          hubFacilities: {
            ...s.hubFacilities,
            [airportId]: [...(s.hubFacilities[airportId] ?? []), facility],
          },
          financeLog: pushLog(s.financeLog, {
            at: now,
            kind: 'hub',
            label: `${def.label} @ ${ap?.code ?? airportId}`,
            amount: -def.cost,
          }),
          notifications: pushNote(
            s.notifications,
            'good',
            `${def.label} built at ${ap?.code ?? airportId}`,
          ),
        }))
        return true
      },

      expandHangar: () => {
        if (get().gameOver || !get().setupComplete) return false
        const slots = get().hangarSlots
        const cost = hangarExpandCost(slots)
        if (get().cash < cost) return false
        const now = Date.now()
        set((s) => ({
          cash: s.cash - cost,
          todayCosts: s.todayCosts + cost,
          hangarSlots: s.hangarSlots + 2,
          financeLog: pushLog(s.financeLog, {
            at: now,
            kind: 'other',
            label: `Expand hangar (+2 slots)`,
            amount: -cost,
          }),
          notifications: pushNote(
            s.notifications,
            'good',
            `Hangar expanded → ${slots + 2} slots`,
          ),
        }))
        return true
      },

      expandFuelTank: () => {
        if (get().gameOver || !get().setupComplete) return false
        const cap = get().fuelCapacity
        const next = nextFuelCapacity(cap)
        if (next == null) return false
        const cost = fuelTankUpgradeCost(cap)
        if (get().cash < cost) return false
        const now = Date.now()
        const added = next - cap
        set((s) => ({
          cash: s.cash - cost,
          todayCosts: s.todayCosts + cost,
          fuelCapacity: next,
          financeLog: pushLog(s.financeLog, {
            at: now,
            kind: 'fuel',
            label: `Fuel tank upgrade (+${Math.round(added).toLocaleString()} L)`,
            amount: -cost,
          }),
          notifications: pushNote(
            s.notifications,
            'good',
            `⛽ Tank expanded → ${Math.round(next).toLocaleString()} L capacity`,
          ),
        }))
        return true
      },

      runMarketing: (level) => {
        if (get().gameOver || !get().setupComplete) return false
        const tier = MARKETING_TIERS.find((t) => t.level === level)
        if (!tier) return false
        if (get().cash < tier.cost) return false
        const now = Date.now()
        set((s) => ({
          cash: s.cash - tier.cost,
          todayCosts: s.todayCosts + tier.cost,
          marketingUntil: now + tier.durationMs,
          marketingLevel: level,
          reputation: Math.min(100, s.reputation + tier.repBoost),
          financeLog: pushLog(s.financeLog, {
            at: now,
            kind: 'marketing',
            label: `Marketing: ${tier.label}`,
            amount: -tier.cost,
          }),
          notifications: pushNote(
            s.notifications,
            'good',
            `${tier.label} campaign live`,
          ),
        }))
        return true
      },

      setInsurance: (on) => {
        if (get().gameOver || !get().setupComplete) return false
        set({ insuranceOn: on, lastInsuranceAt: Date.now() })
        return true
      },

      claimInsurance: (claimId) => {
        if (get().gameOver || !get().setupComplete) return false
        const claim = get().insuranceClaims.find(
          (c) => c.id === claimId && !c.claimed,
        )
        if (!claim) return false
        const now = Date.now()
        set((s) => ({
          cash: s.cash + claim.amount,
          peakCash: Math.max(s.peakCash, s.cash + claim.amount),
          insuranceClaims: s.insuranceClaims.map((c) =>
            c.id === claimId ? { ...c, claimed: true } : c,
          ),
          financeLog: pushLog(s.financeLog, {
            at: now,
            kind: 'insurance',
            label: `Insurance claim: ${claim.reason}`,
            amount: claim.amount,
          }),
          notifications: pushNote(
            s.notifications,
            'good',
            `Claim paid: $${claim.amount.toLocaleString()}`,
          ),
        }))
        playSfx('money', get().soundEnabled)
        return true
      },

      signContract: (offerIndex) => {
        if (get().gameOver || !get().setupComplete) return false
        const offer = CONTRACT_OFFERS[offerIndex]
        if (!offer) return false
        const s0 = get()
        if (s0.reputation < offer.unlockRep) return false
        if (s0.contracts.length >= 3) return false
        const now = Date.now()
        const c = startContract(offer, now)
        set((s) => ({
          contracts: [...s.contracts, c],
          notifications: pushNote(
            s.notifications,
            'good',
            `Contract: ${offer.label}`,
          ),
        }))
        return true
      },

      raiseInvestorCapital: (amount) => {
        if (get().gameOver || !get().setupComplete) return false
        const s0 = get()
        if (s0.isPublic) return false // use public markets only after IPO
        const value = estimateCompanyValue(
          s0.cash,
          s0.ownedAircraft,
          s0.reputation,
        )
        const { stake, ok } = investorRaise(s0.investorStake, amount, value)
        if (!ok) return false
        const now = Date.now()
        set((s) => ({
          cash: s.cash + amount,
          peakCash: Math.max(s.peakCash, s.cash + amount),
          investorStake: stake,
          lastDividendAt: now,
          financeLog: pushLog(s.financeLog, {
            at: now,
            kind: 'investor',
            label: `Investor capital (+${stake.toFixed(1)}% equity)`,
            amount,
          }),
          notifications: pushNote(
            s.notifications,
            'info',
            `Raised ${amount.toLocaleString()} · stake ${stake.toFixed(1)}%`,
          ),
        }))
        return true
      },

      goPublic: () => {
        if (get().gameOver || !get().setupComplete) return false
        const s0 = get()
        if (s0.isPublic) return false
        if (s0.reputation < 55) return false
        if (s0.routes.length < 3) return false
        if (s0.peakCash < 1_500_000 && s0.cash < 800_000) return false
        const value = estimateCompanyValue(
          s0.cash,
          s0.ownedAircraft,
          s0.reputation,
        )
        const raise = Math.round(Math.min(value * 0.35, 4_000_000))
        if (raise < 200_000) return false
        const underwrite = Math.round(raise * 0.04)
        const net = raise - underwrite
        const now = Date.now()
        const stake = Math.min(55, Math.max(s0.investorStake, 22))
        set((s) => ({
          isPublic: true,
          cash: s.cash + net,
          peakCash: Math.max(s.peakCash, s.cash + net),
          investorStake: stake,
          lastDividendAt: now,
          financeLog: pushLog(s.financeLog, {
            at: now,
            kind: 'investor',
            label: `IPO listing ($${net.toLocaleString()})`,
            amount: net,
          }),
          notifications: pushNote(
            s.notifications,
            'good',
            `IPO complete · raised $${net.toLocaleString()} · public company`,
          ),
        }))
        playSfx('achieve', get().soundEnabled)
        return true
      },

      trainCrew: () => {
        if (get().gameOver || !get().setupComplete) return false
        const s0 = get()
        if (s0.crewTraining >= 5) return false
        const cost = 40_000 + s0.crewTraining * 25_000
        if (s0.cash < cost) return false
        const now = Date.now()
        set((s) => ({
          cash: s.cash - cost,
          todayCosts: s.todayCosts + cost,
          crewTraining: s.crewTraining + 1,
          financeLog: pushLog(s.financeLog, {
            at: now,
            kind: 'staff',
            label: 'Crew training program',
            amount: -cost,
          }),
        }))
        return true
      },

      toggleSound: () => {
        set((s) => ({ soundEnabled: !s.soundEnabled }))
      },

      acceptMapCargo: (offerId, aircraftInstanceId, dispatchNow = false) => {
        if (get().gameOver || !get().setupComplete) return false
        const offer = get().mapCargoOffers.find((o) => o.id === offerId)
        if (!offer || offer.kind !== 'map_cargo') return false
        if (!offer.fromId || !offer.toId) return false
        if (
          get().contracts.filter((c) => c.kind === 'map_cargo').length >=
          maxActiveMapCargoJobs()
        ) {
          return false
        }

        const state = get()
        const plane = state.ownedAircraft.find(
          (a) => a.instanceId === aircraftInstanceId,
        )
        if (!plane) return false
        const tons = offer.cargoTons ?? 0
        if (!freighterCanCarry(plane, tons)) {
          set((s) => ({
            notifications: pushNote(
              s.notifications,
              'warn',
              `Freighter too small for ${tons}t cargo`,
            ),
          }))
          return false
        }
        if (plane.flight?.status === 'IN_FLIGHT') {
          set((s) => ({
            notifications: pushNote(
              s.notifications,
              'warn',
              'Pick a freighter that is not in flight',
            ),
          }))
          return false
        }
        if (isAog(plane)) {
          set((s) => ({
            notifications: pushNote(
              s.notifications,
              'warn',
              'Freighter is AOG / in maintenance',
            ),
          }))
          return false
        }

        const from = airports.find((a) => a.id === offer.fromId)
        const to = airports.find((a) => a.id === offer.toId)
        if (!from || !to) return false

        const distanceKm = haversineKm(from.coords, to.coords)
        const rangeErr = validateRouteAirports(plane, from, to, distanceKm)
        if (rangeErr) {
          set((s) => ({
            notifications: pushNote(s.notifications, 'warn', rangeErr),
          }))
          return false
        }

        // Map cargo may leave the hub network — still pay softened slot fee
        const cong = congestionMult(
          offer.fromId,
          offer.toId,
          state.routes,
          state.rivals,
        )
        const aDisc =
          state.allianceId && (state.allianceLevel ?? 0) >= 2 ? 0.12 : 0
        // 55% of normal slots — contract haul, not a permanent network open
        const fee = Math.round(
          slotFeeWithHub(from, to, state.hubId, cong, aDisc) * 0.55,
        )
        if (state.cash < fee) {
          set((s) => ({
            notifications: pushNote(
              s.notifications,
              'warn',
              `Need ${fee.toLocaleString()} cash for cargo slot fees`,
            ),
          }))
          return false
        }

        const now = Date.now()
        const cargoRate = Math.max(1, Math.round(fairCargoRate(distanceKm)))
        // Drop any existing route on this freighter
        const routesWithout = state.routes.filter(
          (r) => r.aircraftInstanceId !== aircraftInstanceId,
        )
        const route: Route = {
          id: crypto.randomUUID(),
          aircraftInstanceId,
          fromId: offer.fromId,
          toId: offer.toId,
          ticketPrice: cargoRate,
          businessPrice: 0,
          firstPrice: 0,
          frequency: 1,
          flightNumber: nextFlightNumber(routesWithout),
          autoFly: false,
          // One delivery leg — park after; reverse is optional
          scheduleLegsLeft: 0,
        }

        // Reposition freighter to pickup (contract ferry, free)
        let flight = groundedFlight(offer.fromId, offer.toId)
        let fuelStock = state.fuelStock
        let departed = false

        if (dispatchNow) {
          const fMult = fuelDepotMult(state.hubFacilities, offer.fromId)
          const scale = state.timeScale ?? 1
          const dep = tryDepart(
            { ...plane, flight },
            offer.fromId,
            offer.toId,
            now,
            fuelStock,
            1,
            fMult,
            scale,
          )
          if (dep) {
            flight = dep.flight
            fuelStock = Math.max(0, fuelStock - dep.fuelBurned)
            departed = true
          }
        }

        set((s) => ({
          cash: s.cash - fee,
          todayCosts: s.todayCosts + fee,
          fuelStock,
          mapCargoOffers: s.mapCargoOffers.filter((o) => o.id !== offerId),
          contracts: [
            ...s.contracts,
            { ...offer, lastPayoutAt: now },
          ],
          routes: [...routesWithout, route],
          ownedAircraft: s.ownedAircraft.map((a) =>
            a.instanceId === aircraftInstanceId ? { ...a, flight } : a,
          ),
          financeLog: pushLog(s.financeLog, {
            at: now,
            kind: 'slot',
            label: `Cargo slot ${from.code}–${to.code}`,
            amount: -fee,
          }),
          notifications: pushNote(
            s.notifications,
            'good',
            departed
              ? `📦 ${route.flightNumber} ${from.code}→${to.code} departed · ${tons}t · +$${Math.round(offer.deliveryPayout ?? 0).toLocaleString()} on delivery`
              : `📦 ${plane.model.split('(')[0].trim()} assigned ${from.code}→${to.code} · ${tons}t · ready to Fly (−$${fee.toLocaleString()} slots)`,
          ),
        }))
        if (departed) playSfx('depart', get().soundEnabled)
        else playSfx('money', get().soundEnabled)
        return true
      },

      buyUsedAircraft: (listingId) => {
        if (get().gameOver || !get().setupComplete) return false
        const listing = usedListingsCache.find((l) => l.id === listingId)
        if (!listing) return false
        if (get().ownedAircraft.length >= get().hangarSlots) return false
        if (get().cash < listing.price) return false
        const template = aircraftCatalog.find((a) => a.id === listing.catalogId)
        if (!template) return false
        const now = Date.now()
        const plane: OwnedAircraft = {
          ...template,
          model: listing.model,
          price: listing.price,
          fuelCostPerKm: listing.fuelCostPerKm,
          maintenancePerDay: listing.maintenancePerDay,
          dailyLeaseCost: listing.dailyLeaseCost,
          instanceId: crypto.randomUUID(),
          ownership: 'OWNED',
          lastLeaseChargeAt: null,
          flight: null,
          acquiredAt: now - listing.hours * 3600_000 * 0.01,
          cabin:
            template.role === 'passenger'
              ? defaultCabin(template.capacity, 'standard')
              : null,
          condition: listing.condition,
          flightHours: listing.hours,
          aogUntil: null,
          lastMaintAt: now,
        }
        usedListingsCache = usedListingsCache.filter((l) => l.id !== listingId)
        set((s) => ({
          cash: s.cash - listing.price,
          todayCosts: s.todayCosts + listing.price,
          ownedAircraft: [...s.ownedAircraft, plane],
          financeLog: pushLog(s.financeLog, {
            at: now,
            kind: 'other',
            label: `Used buy ${listing.model}`,
            amount: -listing.price,
          }),
          notifications: pushNote(
            s.notifications,
            'good',
            `Bought used ${listing.model} · cond ${listing.condition}%`,
          ),
        }))
        playSfx('money', get().soundEnabled)
        return true
      },

      refreshUsedMarket: () => {
        usedListingsCache = generateUsedListings()
      },

      claimSeasonReward: () => {
        if (get().gameOver || !get().setupComplete) return false
        const g = ensureSeasonGoal(get().seasonGoal, Date.now())
        if (g.claimed || !seasonComplete(g)) return false
        const reward = seasonReward(g)
        const name = get().branding.name
        const score = scoreFromState(
          get().peakCash,
          g.legs,
          g.revenue,
          get().reputation,
        )
        const now = Date.now()
        set((s) => ({
          cash: s.cash + reward,
          peakCash: Math.max(s.peakCash, s.cash + reward),
          seasonGoal: { ...g, claimed: true },
          localScores: [
            {
              weekKey: g.weekKey,
              name,
              score,
              at: now,
            },
            ...s.localScores,
          ].slice(0, 40),
          financeLog: pushLog(s.financeLog, {
            at: now,
            kind: 'other',
            label: 'Season goal reward',
            amount: reward,
          }),
          notifications: pushNote(
            s.notifications,
            'good',
            `Season complete! +${reward.toLocaleString()} · score ${score}`,
          ),
        }))
        playSfx('achieve', get().soundEnabled)
        return true
      },

      dismissNotification: (id) => {
        set((s) => ({
          notifications: s.notifications.filter((n) => n.id !== id),
        }))
      },

      advanceTutorial: () => {
        set((s) => {
          const next = s.tutorialStep + 1
          if (next >= 5) {
            return { tutorialStep: 5, tutorialDone: true }
          }
          return { tutorialStep: next }
        })
      },

      skipTutorial: () => {
        set({ tutorialDone: true, tutorialStep: 5 })
      },

      refreshFlights: () => {
        if (get().gameOver || !get().setupComplete) return

        const now = Date.now()
        let state = get()
        const difficultyBias =
          DIFFICULTY[state.difficulty ?? 'normal']?.eventBias ?? 1

        // Day rollover
        const dayKey = localDayKey(new Date(now))
        let todayRevenue = state.todayRevenue
        let todayCosts = state.todayCosts
        if (dayKey !== state.revenueDayKey) {
          todayRevenue = 0
          todayCosts = 0
        }

        // Weekly report rollover
        const wk = currentWeekKey(now)
        let weeklyReport: WeeklyReport =
          state.weeklyReport?.weekKey === wk
            ? { ...state.weeklyReport }
            : emptyWeeklyReport(wk)
        let lastWeekKey = state.lastWeekKey ?? wk
        if (wk !== lastWeekKey) {
          lastWeekKey = wk
          weeklyReport = emptyWeeklyReport(wk)
        }

        // Events
        let activeEvent = state.activeEvent
        let lastEventAt = state.lastEventAt
        if (eventExpired(activeEvent, now)) {
          activeEvent = null
        }
        // Harder difficulty: slightly more frequent events (via lastEventAt bias)
        const eventNow =
          difficultyBias > 1
            ? now + Math.round((difficultyBias - 1) * 8 * 60_000)
            : now
        const spawned = maybeSpawnEvent(eventNow, lastEventAt, activeEvent)
        if (spawned && spawned.id !== activeEvent?.id) {
          activeEvent = spawned
          lastEventAt = now
        }

        // Fuel market
        let fuelPrice = state.fuelPricePerLiter
        let lastFuelPriceAt = state.lastFuelPriceAt
        if (now - lastFuelPriceAt >= FUEL_PRICE_UPDATE_MS) {
          fuelPrice = rollFuelPrice(fuelPrice)
          lastFuelPriceAt = now
        }
        // Deliver aircraft orders (respect hangar)
        let cash = state.cash
        let ownedAircraft = state.ownedAircraft.map(withCatalogDefaults)
        let pendingOrders = [...state.pendingOrders]
        let financeLog = state.financeLog
        const hangarSlots = state.hangarSlots ?? 8
        const delivered: typeof pendingOrders = []
        pendingOrders = pendingOrders.filter((o) => {
          if (o.deliverAt > now) return true
          if (ownedAircraft.length >= hangarSlots) return true
          const balance = o.totalPrice - o.depositPaid
          if (cash < balance) return true // wait until can pay
          cash -= balance
          todayCosts += balance
          const template = aircraftCatalog.find((a) => a.id === o.catalogId)
          if (template) {
            ownedAircraft = [
              ...ownedAircraft,
              {
                ...template,
                instanceId: crypto.randomUUID(),
                ownership: 'OWNED' as const,
                lastLeaseChargeAt: null,
                flight: null,
                acquiredAt: now,
                cabin:
                  template.role === 'passenger'
                    ? defaultCabin(template.capacity, 'standard')
                    : null,
                ...defaultCondition(now),
              },
            ]
            financeLog = pushLog(financeLog, {
              at: now,
              kind: 'order',
              label: `Delivery ${o.model}`,
              amount: -balance,
            })
          }
          delivered.push(o)
          return false
        })

        // Staff payroll
        const staff = applyStaffCharges(
          state.pilots,
          state.cabinCrew,
          state.lastStaffChargeAt,
          now,
        )
        cash -= staff.charged
        todayCosts += staff.charged
        if (staff.charged > 0) {
          financeLog = pushLog(financeLog, {
            at: now,
            kind: 'staff',
            label: 'Crew payroll',
            amount: -staff.charged,
          })
        }

        const coverage = staffCoverage(
          state.pilots,
          state.cabinCrew,
          ownedAircraft,
        )
        const trainBonus = 1 + (state.crewTraining ?? 0) * 0.03
        const staffFactor =
          (0.55 +
            0.45 * Math.min(coverage.pilotRatio, coverage.crewRatio)) *
          trainBonus
        const aLvl = state.allianceId ? (state.allianceLevel ?? 1) : 0
        const allianceDemand =
          aLvl >= 2 ? 1.14 : aLvl >= 1 ? 1.08 : 1
        const mktMult = marketingDemandMult(
          state.marketingUntil ?? 0,
          state.marketingLevel ?? 0,
          now,
        )

        // Rival AI pressure
        let rivals = state.rivals
        let lastRivalTickAt = state.lastRivalTickAt ?? now
        const rivalTick = maybeExpandRivals(
          rivals,
          state.routes,
          now,
          lastRivalTickAt,
          difficultyBias,
        )
        rivals = rivalTick.rivals
        lastRivalTickAt = rivalTick.nextTickAt

        const bases = new Set<string>([
          ...(state.hubId ? [state.hubId] : []),
          ...(state.secondaryBases ?? []),
        ])
        const settleCtx = {
          reputation: state.reputation,
          event: activeEvent,
          rivals,
          staffFactor: staffFactor * allianceDemand,
          hubId: state.hubId,
          marketingMult: mktMult,
          allianceMult: allianceDemand,
          timeScale: state.timeScale ?? 1,
        }

        let contracts = [...(state.contracts ?? [])]
        let mapCargoOffers = refreshMapCargoOffers(
          state.mapCargoOffers ?? [],
          now,
          state.hubId,
        )
        let seasonGoal = ensureSeasonGoal(state.seasonGoal, now)

        // Normalize routes
        let routes = state.routes.map(normalizeRoute)

        let nextFleet = ownedAircraft.map((a) => {
          const route = routes.find((r) => r.aircraftInstanceId === a.instanceId)
          return {
            ...a,
            flight: normalizeFlight(a.flight, a, route),
          }
        })

        let profitDelta = 0
        let revenueDelta = 0
        let nextFuel = state.fuelStock
        let reputation = state.reputation
        let delays = 0
        let notes = state.notifications ?? []
        let flightLog = [...(state.flightLog ?? [])]
        let weekLegs = 0
        let weekDelayed = 0
        let weekFuel = 0
        let weekRev = 0
        let weekCost = 0

        for (const route of routes) {
          const idx = nextFleet.findIndex(
            (a) => a.instanceId === route.aircraftInstanceId,
          )
          if (idx < 0) continue
          if (!nextFleet[idx].flight) {
            nextFleet[idx] = {
              ...nextFleet[idx],
              flight: groundedFlight(route.fromId, route.toId),
            }
          }
          const planeBefore = nextFleet[idx]
          const loungeMult = loungeDemandMult(
            state.hubFacilities,
            route.fromId,
            route.toId,
          )
          const baseNetworkMult =
            bases.has(route.fromId) || bases.has(route.toId) ? 1.03 : 1
          const result = advanceAircraftFlight(
            planeBefore,
            route,
            now,
            nextFuel,
            {
              ...settleCtx,
              conditionMult: conditionDemandMult(planeBefore.condition ?? 100),
              loungeMult,
              baseNetworkMult,
            },
          )
          if (
            result.plane.aogUntil &&
            result.plane.aogUntil > now &&
            (!planeBefore.aogUntil || planeBefore.aogUntil <= now)
          ) {
            notes = pushNote(
              notes,
              'bad',
              `AOG: ${result.plane.model} grounded for maintenance`,
            )
            playSfx('warn', state.soundEnabled)
          }
          nextFleet[idx] = result.plane
          profitDelta += result.profitDelta
          revenueDelta += result.revenueDelta
          nextFuel = Math.max(0, nextFuel - result.fuelBurned)
          delays += result.delays

          if (result.lastLeg) {
            weekLegs += 1
            weekRev += result.lastLeg.revenue
            weekCost += result.lastLeg.revenue - result.lastLeg.profit
            if (result.lastLeg.delayed) weekDelayed += 1
            const entry: FlightLogEntry = {
              id: crypto.randomUUID(),
              at: now,
              flightNumber: route.flightNumber,
              fromId: result.lastLeg.fromId,
              toId: result.lastLeg.toId,
              model: result.plane.model,
              load: result.lastLeg.load,
              revenue: result.lastLeg.revenue,
              profit: result.lastLeg.profit,
              delayed: result.lastLeg.delayed,
            }
            flightLog = [entry, ...flightLog].slice(0, 60)

            // Landing toast + profit summary
            const fromC =
              airports.find((a) => a.id === result.lastLeg!.fromId)?.code ?? '?'
            const toC =
              airports.find((a) => a.id === result.lastLeg!.toId)?.code ?? '?'
            const pSign = result.lastLeg.profit >= 0 ? '+' : ''
            notes = pushNote(
              notes,
              result.lastLeg.profit >= 0 ? 'good' : 'warn',
              `Landed ${route.flightNumber} ${fromC}→${toC} · load ${result.lastLeg.load} · ${pSign}$${Math.round(result.lastLeg.profit).toLocaleString()}${result.lastLeg.delayed ? ' · delayed' : ''}`,
            )
            playSfx('land', state.soundEnabled)
            if (result.lastLeg.profit > 0) {
              playSfx('money', state.soundEnabled)
            }

            // Map cargo delivery (freighter + capacity must match)
            const job = matchMapCargoDelivery(
              contracts,
              result.lastLeg.fromId,
              result.lastLeg.toId,
              result.plane,
            )
            if (job) {
              const pay = job.deliveryPayout ?? 0
              cash += pay
              todayRevenue += pay
              profitDelta += pay
              revenueDelta += pay
              contracts = contracts.map((c) =>
                c.id === job.id ? { ...c, delivered: true } : c,
              )
              // drop completed map cargo
              contracts = contracts.filter(
                (c) => !(c.kind === 'map_cargo' && c.delivered),
              )
              financeLog = pushLog(financeLog, {
                at: now,
                kind: 'cargo',
                label: `Map cargo ${job.label}`,
                amount: pay,
              })
              notes = pushNote(
                notes,
                'good',
                `📦 Delivered ${job.label} · +$${pay.toLocaleString()}`,
              )
              playSfx('money', state.soundEnabled)
            } else if (
              result.plane.role === 'cargo' &&
              contracts.some(
                (c) =>
                  c.kind === 'map_cargo' &&
                  !c.delivered &&
                  c.fromId === result.lastLeg!.fromId &&
                  c.toId === result.lastLeg!.toId &&
                  c.endsAt > now,
              )
            ) {
              // Same OD but freighter too small
              notes = pushNote(
                notes,
                'warn',
                `Cargo job needs larger freighter (cap ${result.plane.capacity}t too small)`,
              )
            }

            // Season progress
            if (!seasonGoal.claimed) {
              seasonGoal = {
                ...seasonGoal,
                legs: seasonGoal.legs + 1,
                revenue: seasonGoal.revenue + result.lastLeg.revenue,
              }
            }

            // Consume one schedule leg after completed flight
            if (route.scheduleLegsLeft > 0) {
              const left = route.scheduleLegsLeft - 1
              routes = routes.map((r) =>
                r.id === route.id
                  ? {
                      ...r,
                      scheduleLegsLeft: left,
                      autoFly: left === 0 ? r.autoFly : true,
                    }
                  : r,
              )
            }
          }
        }

        // Auto-fly / schedule: dispatch when parked
        if (!activeEvent?.groundAll) {
          for (let ri = 0; ri < routes.length; ri++) {
            const route = routes[ri]
            const scheduled =
              route.autoFly ||
              route.scheduleLegsLeft > 0 ||
              route.scheduleLegsLeft === -1
            if (!scheduled) continue
            const idx = nextFleet.findIndex(
              (a) => a.instanceId === route.aircraftInstanceId,
            )
            if (idx < 0) continue
            const plane = nextFleet[idx]
            if (isAog(plane, now)) continue
            if (!plane.flight || plane.flight.status !== 'IDLE') continue
            const fromId = plane.flight.legFromId || route.fromId
            const toId = plane.flight.legToId || route.toId
            const freq = (route.frequency ?? 1) as 1 | 2 | 3
            const fMult = fuelDepotMult(state.hubFacilities, fromId)
            const dep = tryDepart(
              plane,
              fromId,
              toId,
              now,
              nextFuel,
              freq,
              fMult,
              state.timeScale ?? 1,
            )
            if (!dep) continue
            nextFuel = Math.max(0, nextFuel - dep.fuelBurned)
            weekFuel += dep.fuelBurned
            nextFleet[idx] = { ...plane, flight: dep.flight }
          }
        }

        // Lease
        let leaseDelta = 0
        nextFleet = nextFleet.map((plane) => {
          const { plane: updated, charged } = applyLeaseCharges(plane, now)
          leaseDelta += charged
          return updated
        })
        if (leaseDelta > 0) {
          financeLog = pushLog(financeLog, {
            at: now,
            kind: 'lease',
            label: 'Aircraft lease fees',
            amount: -leaseDelta,
          })
          todayCosts += leaseDelta
        }

        // Bank interest (real 24h periods)
        let loans = state.loans ?? []
        const interestTick = applyLoanInterest(loans, now)
        loans = interestTick.loans
        if (interestTick.interestCharged > 0) {
          cash -= interestTick.interestCharged
          todayCosts += interestTick.interestCharged
          financeLog = pushLog(financeLog, {
            at: now,
            kind: 'interest',
            label: 'SkyBank interest',
            amount: -interestTick.interestCharged,
          })
        }

        // Insurance premium
        let lastInsuranceAt = state.lastInsuranceAt ?? now
        let insuranceClaims = [...(state.insuranceClaims ?? [])]
        const ins = insurancePremiumDue(
          lastInsuranceAt,
          now,
          state.insuranceOn ?? false,
        )
        if (ins.charge > 0) {
          cash -= ins.charge
          todayCosts += ins.charge
          lastInsuranceAt = ins.nextAt
          financeLog = pushLog(financeLog, {
            at: now,
            kind: 'insurance',
            label: 'Hull insurance premium',
            amount: -ins.charge,
          })
        }

        // Charter contracts (map cargo excluded from daily tick)
        const charters = contracts.filter((c) => c.kind !== 'map_cargo')
        const mapJobs = contracts.filter((c) => c.kind === 'map_cargo')
        const cTick = tickContracts(charters, now)
        contracts = [
          ...cTick.contracts,
          ...mapJobs.filter((j) => j.endsAt > now && !j.delivered),
        ]
        if (cTick.payout > 0) {
          cash += cTick.payout
          todayRevenue += cTick.payout
          financeLog = pushLog(financeLog, {
            at: now,
            kind: 'contract',
            label: 'Charter contract payout',
            amount: cTick.payout,
          })
        }
        for (const name of cTick.expired) {
          notes = pushNote(notes, 'info', `Contract ended: ${name}`)
        }

        // Weather / event cash hit (softened by insurance) + claim
        if (
          activeEvent?.groundAll &&
          activeEvent.id !== state.activeEvent?.id
        ) {
          const rawHit = 15_000
          const hit = Math.round(
            rawHit * insuranceLossMult(state.insuranceOn ?? false),
          )
          cash -= hit
          todayCosts += hit
          financeLog = pushLog(financeLog, {
            at: now,
            kind: 'fine',
            label: `Weather disruption (${activeEvent.title})`,
            amount: -hit,
          })
          notes = pushNote(notes, 'warn', activeEvent.title)
          playSfx('warn', state.soundEnabled)
          if (state.insuranceOn) {
            const claimAmt = Math.round(rawHit * 0.55)
            insuranceClaims = [
              {
                id: crypto.randomUUID(),
                at: now,
                reason: activeEvent.title,
                amount: claimAmt,
                claimed: false,
              },
              ...insuranceClaims,
            ].slice(0, 12)
            notes = pushNote(
              notes,
              'info',
              `Insurance claim ready: $${claimAmt.toLocaleString()}`,
            )
          }
        }

        if (rivalTick.expanded) {
          notes = pushNote(notes, 'warn', rivalTick.expanded)
          reputation = Math.max(0, reputation - 0.3)
        }

        // Reputation
        if (revenueDelta > 0) {
          reputation = Math.min(100, reputation + 0.05)
          financeLog = pushLog(financeLog, {
            at: now,
            kind: 'ticket',
            label: 'Flight revenue',
            amount: revenueDelta,
          })
        }
        if (delays > 0) {
          reputation = Math.max(0, reputation - delays * 0.4)
        }
        if (coverage.understaffed) {
          reputation = Math.max(0, reputation - 0.02)
        }

        cash = cash + profitDelta - leaseDelta
        todayRevenue += revenueDelta

        weeklyReport = {
          ...weeklyReport,
          weekKey: wk,
          revenue: weeklyReport.revenue + weekRev + (cTick.payout || 0),
          costs: weeklyReport.costs + weekCost + leaseDelta,
          legs: weeklyReport.legs + weekLegs,
          delayedLegs: weeklyReport.delayedLegs + weekDelayed,
          fuelBurned: weeklyReport.fuelBurned + weekFuel,
        }

        // Track taxable profit this period
        let taxPeriodProfit =
          (state.taxPeriodProfit ?? 0) + profitDelta + cTick.payout - leaseDelta
        let lastTaxAt = state.lastTaxAt ?? now
        let lastDividendAt = state.lastDividendAt ?? now
        const taxRes = computeTax(taxPeriodProfit, lastTaxAt, now)
        if (taxRes.shouldReset) {
          if (taxRes.tax > 0) {
            cash -= taxRes.tax
            todayCosts += taxRes.tax
            financeLog = pushLog(financeLog, {
              at: now,
              kind: 'tax',
              label: 'Corporate tax',
              amount: -taxRes.tax,
            })
          }
          const div = dividendDue(
            state.investorStake ?? 0,
            taxPeriodProfit,
            lastDividendAt,
            now,
          )
          if (div.amount > 0) {
            cash -= div.amount
            todayCosts += div.amount
            lastDividendAt = div.nextAt
            financeLog = pushLog(financeLog, {
              at: now,
              kind: 'investor',
              label: 'Investor dividend',
              amount: -div.amount,
            })
          }
          taxPeriodProfit = 0
          lastTaxAt = now
        }

        const peakCash = Math.max(state.peakCash, cash)
        if (cash > state.peakCash + 1) {
          notes = pushNote(notes, 'good', 'New peak cash record!')
        }

        // Marketing expiry
        let marketingLevel = state.marketingLevel ?? 0
        let marketingUntil = state.marketingUntil ?? 0
        if (marketingUntil > 0 && marketingUntil <= now) {
          marketingLevel = 0
          marketingUntil = 0
        }

        // Achievements
        let achievements = [...(state.achievements ?? [])]
        const probe: GameState = {
          ...state,
          cash,
          peakCash,
          ownedAircraft: nextFleet,
          routes,
          loans,
          isPublic: state.isPublic,
          insuranceClaims,
          achievements,
        }
        const newAch = evaluateNewAchievements(probe)
        if (newAch.length > 0) {
          achievements = [...achievements, ...newAch]
          for (const id of newAch) {
            const def = ACHIEVEMENT_DEFS.find((a) => a.id === id)
            notes = pushNote(
              notes,
              'good',
              `Achievement: ${def?.title ?? id}`,
            )
          }
          playSfx('achieve', state.soundEnabled)
        }

        set({
          cash,
          peakCash,
          todayRevenue,
          todayCosts,
          revenueDayKey: dayKey,
          financeLog,
          fuelStock: nextFuel,
          fuelPricePerLiter: fuelPrice,
          lastFuelPriceAt,
          ownedAircraft: nextFleet,
          routes,
          pendingOrders,
          loans,
          contracts,
          mapCargoOffers,
          seasonGoal,
          insuranceOn: state.insuranceOn,
          lastInsuranceAt,
          insuranceClaims,
          lastTaxAt,
          taxPeriodProfit,
          lastDividendAt,
          marketingLevel: marketingLevel as 0 | 1 | 2 | 3,
          marketingUntil,
          activeEvent,
          lastEventAt,
          reputation,
          lastStaffChargeAt: staff.nextChargeAt,
          notifications: notes,
          rivals,
          lastRivalTickAt,
          flightLog,
          weeklyReport,
          lastWeekKey,
          achievements,
          gameOver: cash < 0,
        })
      },

      newGame: () => {
        set({ ...createInitialState() })
      },
    }),
    {
      name: SAVE_KEY,
      partialize: (s): GameState => serializeGameState(s),
      merge: (persisted, current) => ({
        ...current,
        ...mergeGameState(
          persisted as Partial<GameState> | undefined,
          current,
        ),
      }),
    },
  ),
)

/** Replace live game with cloud/local snapshot. */
export function hydrateGameState(partial: Partial<GameState>): void {
  const current = serializeGameState(useGameStore.getState())
  const next = mergeGameState(partial, current)
  useGameStore.setState(next)
}
