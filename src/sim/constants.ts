/**
 * Tunable simulation constants.
 *
 * Flight duration is wall-clock real time (1:1):
 * CGK–KUL ~2–3 real hours until landing.
 */

/**
 * Default compress factor when state.timeScale missing (legacy).
 * Prefer GameState.timeScale (1 | 30 | 60).
 */
export const FLIGHT_TIME_SCALE = 1

/** Ground hold after arrival before reverse leg is ready (ms). */
export const TURNAROUND_MS = 0

/**
 * Real-time economy: fewer sectors per day → higher yield per leg.
 * Tuned so short regional hops cover fuel + a slice of lease after ~1–2 legs.
 */
export const REALTIME_REVENUE_MULT = 2.65

/** Soften maintenance under real-time (lease still bites daily). */
export const REALTIME_COST_MULT = 0.8

/**
 * Assumed $/L when folding fuel into leg P&L (stock is bought earlier;
 * this keeps toast profit honest vs pure ticket revenue).
 */
export const LEG_FUEL_COST_PER_L = 1.1
