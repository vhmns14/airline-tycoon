/**
 * Shared domain types for Airline Tycoon.
 */

export type AircraftRole = 'passenger' | 'cargo'

/** Density affects seats/payload vs range. */
export type CabinDensity = 'dense' | 'standard' | 'comfort'

/** Silhouette style for compact aircraft thumbnails. */
export type AircraftBodyClass =
  | 'light'
  | 'turboprop'
  | 'regional'
  | 'narrowbody'
  | 'widebody'
  | 'super'

export type Aircraft = {
  id: string
  model: string
  /** OEM brand for market grouping (Boeing, Airbus, …). */
  manufacturer: string
  role: AircraftRole
  /** Base seats (pax) or tonnes (cargo) before density config. */
  capacity: number
  rangeKm: number
  speedKmh: number
  price: number
  dailyLeaseCost: number
  fuelCostPerKm: number
  maintenancePerDay: number
  /** Minimum airport size that can accept this aircraft (1–5). */
  minAirportSize: 1 | 2 | 3 | 4 | 5
  /** Thumbnail silhouette class (fallback if image missing). */
  bodyClass: AircraftBodyClass
  /** Public image key under /aircraft/{imageKey}.jpg */
  imageKey: string
}

export type AirportCoords = { lat: number; lng: number }

export type Airport = {
  id: string
  city: string
  code: string
  size: 1 | 2 | 3 | 4 | 5
  coords: AirportCoords
}

export type FlightStatus = 'IN_FLIGHT' | 'IDLE'

export type FlightState = {
  status: FlightStatus
  legFromId: string
  legToId: string
  departAt: number
  arriveAt: number
}

export type Ownership = 'OWNED' | 'LEASED'

/** Passenger cabin split (seats). Sum ≈ effective capacity. */
export type CabinConfig = {
  density: CabinDensity
  economy: number
  business: number
  first: number
}

export type OwnedAircraft = Aircraft & {
  instanceId: string
  ownership: Ownership
  lastLeaseChargeAt: number | null
  flight: FlightState | null
  /** When acquired (buy/lease/delivery). */
  acquiredAt: number
  /** Seat layout (passenger only). */
  cabin: CabinConfig | null
  /** Airframe health 0–100. */
  condition: number
  /** Cumulative flight hours (sim). */
  flightHours: number
  /** Grounded for maintenance until this timestamp. */
  aogUntil: number | null
  lastMaintAt: number
}

export type Route = {
  id: string
  aircraftInstanceId: string
  fromId: string
  toId: string
  /**
   * Pax: economy ticket $.
   * Cargo: $ per tonne.
   */
  ticketPrice: number
  /** Business / first prices (pax only; 0 if unused). */
  businessPrice: number
  firstPrice: number
  /** How hard the plane is worked (1–3). Multiplies fuel + revenue opportunities. */
  frequency: 1 | 2 | 3
  /** e.g. AT101 */
  flightNumber: string
  /** If true, auto-dispatch when parked (player opt-in). */
  autoFly: boolean
  /**
   * Remaining auto-dispatch legs after each park (0 = off).
   * e.g. 4 = four more departures (two round-trips on a pair).
   * -1 = unlimited while autoFly or schedule on.
   */
  scheduleLegsLeft: number
}

export type Difficulty = 'easy' | 'normal' | 'hard'

/** Wall-clock flight compression. 1 = real time. */
export type TimeScale = 1 | 30 | 60

/** Built facilities at a hub / secondary base. */
export type HubFacilityId = 'fuel' | 'lounge' | 'mro'

export type FlightLogEntry = {
  id: string
  at: number
  flightNumber: string
  fromId: string
  toId: string
  model: string
  load: number
  revenue: number
  profit: number
  delayed: boolean
}

export type WeeklyReport = {
  weekKey: string
  revenue: number
  costs: number
  legs: number
  delayedLegs: number
  fuelBurned: number
}

export type InsuranceClaim = {
  id: string
  at: number
  reason: string
  amount: number
  claimed: boolean
}

export type Branding = {
  name: string
  slogan: string
  logoEmoji: string
  primaryColor: string
  secondaryColor: string
}

export type FinanceEntry = {
  id: string
  at: number
  kind:
    | 'ticket'
    | 'cargo'
    | 'fuel'
    | 'lease'
    | 'slot'
    | 'staff'
    | 'maintenance'
    | 'event'
    | 'order'
    | 'hub'
    | 'loan'
    | 'interest'
    | 'marketing'
    | 'tax'
    | 'insurance'
    | 'investor'
    | 'contract'
    | 'sell'
    | 'fine'
    | 'other'
  label: string
  amount: number
}

/** Outstanding bank loan (real-time interest). */
export type Loan = {
  id: string
  principal: number
  remaining: number
  dailyRate: number
  takenAt: number
  lastInterestAt: number
  productId: string
  label: string
}

export type GameEventKind =
  | 'fuel_spike'
  | 'fuel_crash'
  | 'storm'
  | 'festival'
  | 'strike'
  | 'boom'
  | 'typhoon'
  | 'ash_cloud'
  | 'fog'

export type GameEvent = {
  id: string
  kind: GameEventKind
  title: string
  description: string
  endsAt: number
  fuelPriceMult: number
  demandMult: number
  delayChance: number
  /** Optional: ground all departures while active. */
  groundAll?: boolean
}

export type AircraftOrder = {
  id: string
  catalogId: string
  model: string
  role: AircraftRole
  deliverAt: number
  totalPrice: number
  depositPaid: number
}

export type RivalAirline = {
  id: string
  name: string
  logoEmoji: string
  routes: string[]
}

export type ContractKind = 'pax_charter' | 'cargo_charter' | 'mail' | 'map_cargo'

export type ActiveContract = {
  id: string
  kind: ContractKind
  label: string
  /** Payout every charge period (charters). Map cargo uses payout once. */
  payoutPerDay: number
  endsAt: number
  lastPayoutAt: number
  /** Map cargo OD + payload (optional). */
  fromId?: string
  toId?: string
  cargoTons?: number
  /** One-shot payout on delivery. */
  deliveryPayout?: number
  delivered?: boolean
}

/** Local season / weekly challenge progress. */
export type SeasonGoal = {
  weekKey: string
  targetLegs: number
  targetRevenue: number
  legs: number
  revenue: number
  claimed: boolean
}

export type GameNotification = {
  id: string
  at: number
  tone: 'info' | 'good' | 'warn' | 'bad'
  text: string
}

export type GameState = {
  branding: Branding
  hubId: string | null
  setupComplete: boolean
  difficulty: Difficulty
  /** Flight wall-clock scale (1 = real-time hours). */
  timeScale: TimeScale

  reputation: number
  allianceId: string | null
  /** Codeshare tier when in alliance: demand + slot discount. */
  allianceLevel: 0 | 1 | 2

  cash: number
  peakCash: number
  todayRevenue: number
  todayCosts: number
  revenueDayKey: string
  gameStartedAtMs: number
  financeLog: FinanceEntry[]
  loans: Loan[]

  fuelStock: number
  fuelCapacity: number
  fuelPricePerLiter: number
  lastFuelPriceAt: number

  pilots: number
  cabinCrew: number
  lastStaffChargeAt: number
  /** Extra training reduces understaff penalty. 0–5 */
  crewTraining: number

  ownedAircraft: OwnedAircraft[]
  routes: Route[]
  pendingOrders: AircraftOrder[]

  /** Hangar slots (owned + leased count). Expand with cash. */
  hangarSlots: number

  /** Secondary operating bases (airport ids) beyond home hub. */
  secondaryBases: string[]

  /**
   * Facilities built at home hub or secondary bases.
   * Key = airport id.
   */
  hubFacilities: Record<string, HubFacilityId[]>

  /** Marketing campaign active until. */
  marketingUntil: number
  marketingLevel: 0 | 1 | 2 | 3

  /** Hull insurance — daily premium, softens storm/event losses. */
  insuranceOn: boolean
  lastInsuranceAt: number
  /** Pending claims player can cash. */
  insuranceClaims: InsuranceClaim[]

  lastTaxAt: number
  /** Rolling profit tracker for tax period. */
  taxPeriodProfit: number

  contracts: ActiveContract[]
  /** Offered map cargo jobs (not yet accepted or active). */
  mapCargoOffers: ActiveContract[]

  /** Investor equity 0–35 (%); IPO can go higher. */
  investorStake: number
  lastDividendAt: number
  /** Public company after IPO. */
  isPublic: boolean

  seasonGoal: SeasonGoal
  /** Local high scores: weekKey → score. */
  localScores: { weekKey: string; name: string; score: number; at: number }[]

  activeEvent: GameEvent | null
  lastEventAt: number
  rivals: RivalAirline[]
  lastRivalTickAt: number

  flightLog: FlightLogEntry[]
  weeklyReport: WeeklyReport
  lastWeekKey: string

  /** Unlocked achievement ids. */
  achievements: string[]

  soundEnabled: boolean

  tutorialStep: number
  tutorialDone: boolean

  /** Recent UI toasts (capped). */
  notifications: GameNotification[]

  gameOver: boolean
}

export type LegSettlement = {
  routeId: string
  fromId: string
  toId: string
  load: number
  role: AircraftRole
  revenue: number
  cost: number
  profit: number
  delayed: boolean
}
