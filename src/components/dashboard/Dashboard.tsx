/**
 * Ops desk — dense card grid (less empty space, less scroll).
 */

import { airports } from '../../data/airports'
import { formatMoney, formatNumber } from '../../lib/format'
import { formatDurationHm, formatLocalTime } from '../../lib/time'
import { useGameStore } from '../../store/gameStore'
import type { OwnedAircraft } from '../../types'
import { EmptyState } from '../ui/EmptyState'
import { FlyAllBar } from '../ui/FlyAllBar'
import { GamePanel } from '../ui/GamePanel'
import { GoalsCard } from './GoalsCard'

export function Dashboard() {
  const branding = useGameStore((s) => s.branding)
  const cash = useGameStore((s) => s.cash)
  const todayRevenue = useGameStore((s) => s.todayRevenue)
  const peakCash = useGameStore((s) => s.peakCash)
  const fuelStock = useGameStore((s) => s.fuelStock)
  const fuelCapacity = useGameStore((s) => s.fuelCapacity)
  const fuelPrice = useGameStore((s) => s.fuelPricePerLiter)
  const activeEvent = useGameStore((s) => s.activeEvent)
  const ownedAircraft = useGameStore((s) => s.ownedAircraft)
  const routes = useGameStore((s) => s.routes)
  const reputation = useGameStore((s) => s.reputation)
  const achievements = useGameStore((s) => s.achievements)
  const weeklyReport = useGameStore((s) => s.weeklyReport)
  const seasonGoal = useGameStore((s) => s.seasonGoal)
  const timeScale = useGameStore((s) => s.timeScale)
  const effFuel = fuelPrice * (activeEvent?.fuelPriceMult ?? 1)

  const nowMs = Date.now()
  const fleetCount = ownedAircraft.length
  const routeCount = routes.length
  const activeFlights = ownedAircraft.filter(
    (a) => a.flight?.status === 'IN_FLIGHT',
  ).length
  const readyCount = ownedAircraft.filter(
    (a) => a.flight?.status === 'IDLE',
  ).length

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-12">
      {/* ── Row 1: identity + treasury ── */}
      <div className="game-panel col-span-2 lg:col-span-8">
        <div className="game-panel-body flex flex-wrap items-center justify-between gap-3 !py-3.5 sm:!py-4">
          <div className="min-w-0">
            <p className="font-display text-xs font-semibold uppercase tracking-[0.18em] text-[var(--game-brass)]">
              Ops desk
            </p>
            <h2 className="screen-title mt-0.5 truncate">
              {branding.logoEmoji} {branding.name}
            </h2>
            <p className="screen-sub mt-1">
              Live · {formatLocalTime()} · rep {reputation.toFixed(0)} ·{' '}
              {timeScale ?? 1}× time
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <FlyAllBar />
            {readyCount > 0 && (
              <span className="rounded-md border border-[rgba(143,173,122,0.35)] bg-[rgba(143,173,122,0.1)] px-2.5 py-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--game-cash)]">
                {readyCount} ready
              </span>
            )}
            {activeFlights > 0 && (
              <span className="rounded-md border border-[rgba(196,163,90,0.3)] bg-[rgba(196,163,90,0.08)] px-2.5 py-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--game-brass)]">
                {activeFlights} airborne
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="game-panel col-span-2 lg:col-span-4">
        <div className="game-panel-body flex h-full flex-col justify-center !py-3.5 sm:!py-4">
          <p className="font-display text-xs font-semibold uppercase tracking-[0.14em] text-[var(--game-dim)]">
            Treasury
          </p>
          <p
            className={[
              'font-display mt-1 text-3xl font-semibold tabular-nums sm:text-4xl',
              cash >= 0
                ? 'text-[var(--game-cash)]'
                : 'text-[var(--game-danger)]',
            ].join(' ')}
          >
            {formatMoney(cash)}
          </p>
          <p className="mt-1 text-sm text-[var(--game-muted)]">
            Peak {formatMoney(peakCash)} · {formatNumber(fleetCount)} aircraft
          </p>
        </div>
      </div>

      {/* ── Row 2: KPI cards ── */}
      <StatCard
        className="lg:col-span-2 sm:col-span-1"
        icon="💵"
        label="Cash"
        value={formatMoney(cash)}
        accent={cash >= 0 ? '#8fad7a' : '#b85c4a'}
        valueClass={
          cash >= 0 ? 'text-[var(--game-cash)]' : 'text-[var(--game-danger)]'
        }
      />
      <StatCard
        className="lg:col-span-3 sm:col-span-1"
        icon="⛽"
        label="Fuel farm"
        value={`${formatNumber(Math.round(fuelStock))} L`}
        accent="#c4894a"
        valueClass={
          fuelStock / fuelCapacity < 0.15
            ? 'text-[var(--game-warn)]'
            : 'text-[var(--game-fuel)]'
        }
        hint={`${formatMoney(effFuel)}/L · cap ${formatNumber(fuelCapacity)}`}
        bar={fuelCapacity > 0 ? fuelStock / fuelCapacity : 0}
      />
      <StatCard
        className="lg:col-span-2"
        icon="📈"
        label="Today rev"
        value={formatMoney(todayRevenue)}
        accent="#c4a35a"
        valueClass="text-[var(--game-brass)]"
      />
      <StatCard
        className="lg:col-span-2"
        icon="🛫"
        label="In flight"
        value={formatNumber(activeFlights)}
        accent="#7a8f6a"
        valueClass="text-[var(--game-olive)]"
        hint={`${formatNumber(routeCount)} routes`}
      />
      <StatCard
        className="lg:col-span-3"
        icon="🏆"
        label="Peak cash"
        value={formatMoney(peakCash)}
        accent="#d4b86a"
        valueClass="text-[var(--game-brass-hi)]"
        hint={`${formatNumber(fleetCount)} aircraft`}
      />

      {/* ── Row 3: missions + week + live ops side by side ── */}
      <div className="col-span-2 lg:col-span-5">
        <GoalsCard />
      </div>

      <div className="col-span-2 flex flex-col gap-3 sm:col-span-1 lg:col-span-3">
        <WeekCard report={weeklyReport} />
        {seasonGoal && (
          <div className="game-panel px-3 py-2.5 text-sm">
            <p className="font-display text-xs font-semibold uppercase tracking-wide text-[var(--game-brass)]">
              Season · {seasonGoal.weekKey}
            </p>
            <p className="mt-1 text-[var(--game-muted)]">
              {seasonGoal.legs}/{seasonGoal.targetLegs} legs ·{' '}
              {formatMoney(seasonGoal.revenue)} /{' '}
              {formatMoney(seasonGoal.targetRevenue)}
            </p>
            {seasonGoal.claimed && (
              <p className="mt-0.5 text-xs text-[var(--game-cash)]">Reward claimed</p>
            )}
          </div>
        )}
        {achievements.length > 0 && (
          <div className="game-panel px-3 py-2.5 text-sm text-[var(--game-brass)]">
            ★ {achievements.length} achievement
            {achievements.length === 1 ? '' : 's'} · Airline tab
          </div>
        )}
        {fleetCount === 0 && (
          <EmptyState
            title="Hangar empty"
            message="Buy or rent a starter prop."
            hint="Hangar → Cessna / Twin Otter"
          />
        )}
        {fleetCount > 0 && fuelStock < 500 && (
          <EmptyState
            title="Fuel critical"
            message="Planes stay grounded."
            hint="Fuel tab → top up"
          />
        )}
        {fleetCount > 0 && routeCount === 0 && (
          <EmptyState
            title="No routes"
            message="Assign a city pair."
            hint="Routes → open → Fly"
          />
        )}
      </div>

      <div className="col-span-2 sm:col-span-1 lg:col-span-4">
        <GamePanel
          title="Live ops"
          icon="📡"
          className="h-full"
          bodyClassName="!pt-2"
          right={
            <span className="flex items-center gap-1.5 text-xs text-[var(--game-dim)]">
              <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--game-cash)]" />
              live
            </span>
          }
        >
          {fleetCount === 0 ? (
            <EmptyState title="No aircraft" message="Hangar is waiting." />
          ) : (
            <div className="grid max-h-[min(28rem,55vh)] gap-2 overflow-y-auto lg:max-h-[22rem]">
              {ownedAircraft.map((plane) => (
                <OpsCard key={plane.instanceId} plane={plane} nowMs={nowMs} />
              ))}
            </div>
          )}
        </GamePanel>
      </div>
    </div>
  )
}

function StatCard({
  icon,
  label,
  value,
  accent,
  valueClass,
  hint,
  bar,
  className = '',
}: {
  icon: string
  label: string
  value: string
  accent: string
  valueClass?: string
  hint?: string
  bar?: number
  className?: string
}) {
  return (
    <div
      className={`stat-card col-span-1 ${className}`}
      style={{ ['--card-accent' as string]: accent }}
    >
      <div className="flex items-start justify-between gap-1">
        <p className="stat-card-label">{label}</p>
        <span className="text-base opacity-80">{icon}</span>
      </div>
      <p className={`stat-card-value ${valueClass ?? ''}`}>{value}</p>
      {hint && (
        <p className="mt-1 text-xs text-[var(--game-dim)]">{hint}</p>
      )}
      {typeof bar === 'number' && (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/40">
          <div
            className="h-full rounded-full transition-[width] duration-500"
            style={{
              width: `${Math.min(100, Math.max(0, bar * 100))}%`,
              background: accent,
            }}
          />
        </div>
      )}
    </div>
  )
}

function WeekCard({
  report,
}: {
  report: {
    weekKey: string
    revenue: number
    legs: number
    delayedLegs: number
  }
}) {
  const empty = !report || (report.legs === 0 && report.revenue === 0)
  return (
    <div className="game-panel h-full">
      <header className="game-panel-header">
        <h3 className="game-panel-title">📅 This week</h3>
      </header>
      <div className="game-panel-body">
        {empty ? (
          <p className="text-sm text-[var(--game-dim)]">
            Debrief fills as legs complete…
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <p className="text-xs text-[var(--game-dim)]">Week</p>
              <p className="font-display font-semibold">{report.weekKey}</p>
            </div>
            <div>
              <p className="text-xs text-[var(--game-dim)]">Revenue</p>
              <p className="font-display font-semibold text-[var(--game-cash)]">
                {formatMoney(report.revenue)}
              </p>
            </div>
            <div>
              <p className="text-xs text-[var(--game-dim)]">Legs</p>
              <p className="font-display font-semibold">
                {formatNumber(report.legs)}
              </p>
            </div>
            <div>
              <p className="text-xs text-[var(--game-dim)]">Delayed</p>
              <p
                className={[
                  'font-display font-semibold',
                  report.delayedLegs > 0
                    ? 'text-[var(--game-warn)]'
                    : 'text-[var(--game-muted)]',
                ].join(' ')}
              >
                {formatNumber(report.delayedLegs)}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function OpsCard({
  plane,
  nowMs,
}: {
  plane: OwnedAircraft
  nowMs: number
}) {
  const routes = useGameStore((s) => s.routes)
  const gameOver = useGameStore((s) => s.gameOver)
  const dispatchFlight = useGameStore((s) => s.dispatchFlight)
  const route = routes.find((r) => r.aircraftInstanceId === plane.instanceId)
  const status = describeAircraftStatus(plane, nowMs)
  const canFly = plane.flight?.status === 'IDLE' && !!route && !gameOver
  const progress =
    plane.flight?.status === 'IN_FLIGHT' &&
    plane.flight.arriveAt > plane.flight.departAt
      ? Math.min(
          1,
          Math.max(
            0,
            (nowMs - plane.flight.departAt) /
              (plane.flight.arriveAt - plane.flight.departAt),
          ),
        )
      : null

  return (
    <div
      className={[
        'ops-card',
        plane.flight?.status === 'IN_FLIGHT' ? 'ops-card-flying' : '',
        canFly ? 'ops-card-ready ready-pulse' : '',
      ].join(' ')}
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-black/30 text-lg">
        {plane.role === 'cargo' ? '📦' : '✈️'}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <p className="truncate text-sm font-semibold">{plane.model}</p>
          {route?.flightNumber && (
            <span className="font-display text-xs text-[var(--game-brass)]">
              {route.flightNumber}
            </span>
          )}
        </div>
        <p className="truncate text-xs text-[var(--game-muted)]">
          {status.detail}
        </p>
        {progress != null && (
          <div className="flight-progress mt-1.5">
            <span style={{ width: `${progress * 100}%` }} />
          </div>
        )}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <span
          className={`font-display text-xs font-semibold uppercase tracking-wide ${status.textClass}`}
        >
          {status.label}
        </span>
        <span className="text-xs tabular-nums text-[var(--game-dim)]">
          {status.eta ?? '—'}
        </span>
        {route && (
          <button
            type="button"
            disabled={!canFly}
            onClick={() => dispatchFlight(route.id)}
            className={[
              'btn-game mt-0.5 !px-3 !py-1 !text-xs',
              canFly ? 'btn-game-success' : 'btn-game-ghost',
            ].join(' ')}
          >
            Fly
          </button>
        )}
      </div>
    </div>
  )
}

type StatusView = {
  label: string
  detail: string
  eta: string | null
  textClass: string
}

function describeAircraftStatus(
  plane: OwnedAircraft,
  nowMs: number,
): StatusView {
  const flight = plane.flight

  if (!flight) {
    return {
      label: 'Hangar',
      detail: 'No route assigned',
      eta: null,
      textClass: 'text-[var(--game-dim)]',
    }
  }

  const from = airports.find((a) => a.id === flight.legFromId)
  const to = airports.find((a) => a.id === flight.legToId)
  const pair = `${from?.code ?? '?'} → ${to?.code ?? '?'}`

  if (flight.status === 'IN_FLIGHT') {
    return {
      label: 'Airborne',
      detail: pair,
      eta: `ETA ${formatDurationHm(Math.max(0, flight.arriveAt - nowMs))}`,
      textClass: 'text-[var(--game-olive)]',
    }
  }

  return {
    label: 'Ready',
    detail: `${pair} · gate`,
    eta: 'Dispatch',
    textClass: 'text-[var(--game-cash)]',
  }
}
