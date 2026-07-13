/**
 * Routes tab: open new routes + list / remove active ones.
 */

import { useEffect, useMemo, useState } from 'react'
import { airports } from '../../data/airports'
import { haversineKm } from '../../lib/geo'
import { formatMoney, formatNumber } from '../../lib/format'
import { slotFeeWithHub, validateRouteAirports } from '../../sim/airportRules'
import { effectiveRangeKm } from '../../sim/cabin'
import {
  fairCargoRate,
  fairPassengerPrice,
} from '../../sim/economy'
import { fuelUpliftForDispatch } from '../../sim/fuel'
import {
  destinationsInRange,
  suggestDestinations,
} from '../../sim/routeSuggestions'
import { useGameStore } from '../../store/gameStore'
import type { Airport, FlightStatus, OwnedAircraft } from '../../types'
import { AirportSelect } from '../ui/AirportSelect'
import { EmptyState } from '../ui/EmptyState'
import { FlyAllBar } from '../ui/FlyAllBar'

export function RoutesPanel() {
  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
      <div className="col-span-full flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="screen-title">🛫 Routes</h2>
          <p className="screen-sub">
            Open → park →{' '}
            <strong className="text-[var(--game-cash)]">Fly</strong> (or Fly
            all). Safe offline.
          </p>
        </div>
        <FlyAllBar />
      </div>

      <div className="lg:col-span-5">
        <OpenRouteForm />
      </div>
      <div className="lg:col-span-7">
        <ActiveRoutesList />
      </div>
    </div>
  )
}

/** Bases you can launch from: HQ + secondary bases + airports on network. */
function useOriginAirports(
  hubId: string | null,
  secondaryBases: string[],
  routes: { fromId: string; toId: string }[],
) {
  return useMemo(() => {
    const ids = new Set<string>()
    if (hubId) ids.add(hubId)
    for (const id of secondaryBases) ids.add(id)
    for (const r of routes) {
      ids.add(r.fromId)
      ids.add(r.toId)
    }
    const list: Airport[] = []
    for (const id of ids) {
      const a = airports.find((x) => x.id === id)
      if (a) list.push(a)
    }
    // Home hub first, then secondary bases, then network
    list.sort((a, b) => {
      if (a.id === hubId) return -1
      if (b.id === hubId) return 1
      const aBase = secondaryBases.includes(a.id) ? 0 : 1
      const bBase = secondaryBases.includes(b.id) ? 0 : 1
      if (aBase !== bBase) return aBase - bBase
      return a.code.localeCompare(b.code)
    })
    return list
  }, [hubId, secondaryBases, routes])
}

function OpenRouteForm() {
  const ownedAircraft = useGameStore((s) => s.ownedAircraft)
  const routes = useGameStore((s) => s.routes)
  const fuelStock = useGameStore((s) => s.fuelStock)
  const hubId = useGameStore((s) => s.hubId)
  const secondaryBases = useGameStore((s) => s.secondaryBases)
  const cash = useGameStore((s) => s.cash)
  const gameOver = useGameStore((s) => s.gameOver)
  const openRoute = useGameStore((s) => s.openRoute)
  const [frequency, setFrequency] = useState<1 | 2 | 3>(1)
  const [businessPrice, setBusinessPrice] = useState('')
  const [firstPrice, setFirstPrice] = useState('')

  const originAirports = useOriginAirports(hubId, secondaryBases, routes)
  const hasSecondaryHub = originAirports.length > 1

  const idleAircraft = useMemo(
    () =>
      ownedAircraft.filter(
        (plane) =>
          !plane.flight &&
          !routes.some((r) => r.aircraftInstanceId === plane.instanceId),
      ),
    [ownedAircraft, routes],
  )

  const [aircraftInstanceId, setAircraftInstanceId] = useState('')
  // Default origin = home hub (planes basing there)
  const [fromId, setFromId] = useState(hubId ?? '')
  const [toId, setToId] = useState('')
  const [ticketPrice, setTicketPrice] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Keep From locked to hub when hub changes / first load
  useEffect(() => {
    if (!hubId) return
    if (!hasSecondaryHub) {
      setFromId(hubId)
      return
    }
    // If current from is not a valid base, snap to hub
    if (!originAirports.some((a) => a.id === fromId)) {
      setFromId(hubId)
    }
  }, [hubId, hasSecondaryHub, originAirports, fromId])

  const selectedPlane: OwnedAircraft | undefined = ownedAircraft.find(
    (a) => a.instanceId === aircraftInstanceId,
  )

  const fromAirport = airports.find((a) => a.id === fromId)
  const toAirport = airports.find((a) => a.id === toId)

  const planeRangeKm = selectedPlane ? effectiveRangeKm(selectedPlane) : null

  /** All destinations this plane can reach from current origin. */
  const inRangeList = useMemo(() => {
    if (!selectedPlane || !fromId) return []
    return destinationsInRange(selectedPlane, fromId)
  }, [selectedPlane, fromId])

  const inRangeAirports = useMemo(
    () => inRangeList.map((s) => s.airport),
    [inRangeList],
  )

  /** Top chip suggestions ranked by market + range fit. */
  const routeSuggestions = useMemo(() => {
    if (!selectedPlane || !fromId) return []
    return suggestDestinations(selectedPlane, fromId, 10)
  }, [selectedPlane, fromId])

  // Clear destination if it becomes out of range after plane/from change
  useEffect(() => {
    if (!toId || !selectedPlane || !fromId) return
    const ok = inRangeList.some((s) => s.airport.id === toId)
    if (!ok) setToId('')
  }, [selectedPlane, fromId, toId, inRangeList])

  const distanceKm = useMemo(() => {
    if (!fromAirport || !toAirport || fromId === toId) return null
    return haversineKm(fromAirport.coords, toAirport.coords)
  }, [fromAirport, toAirport, fromId, toId])

  const isCargo = selectedPlane?.role === 'cargo'

  const fairPrice =
    distanceKm !== null
      ? Math.round(
          isCargo
            ? fairCargoRate(distanceKm)
            : fairPassengerPrice(distanceKm),
        )
      : null

  function applySuggestedPrice(nextFair: number) {
    setTicketPrice(String(nextFair))
    setBusinessPrice(String(Math.round(nextFair * 2.2)))
    setFirstPrice(String(Math.round(nextFair * 4.5)))
  }

  function suggestForPair(
    plane: OwnedAircraft | undefined,
    aId: string,
    bId: string,
  ) {
    const from = airports.find((a) => a.id === aId)
    const to = airports.find((a) => a.id === bId)
    if (!from || !to || aId === bId) return
    const d = haversineKm(from.coords, to.coords)
    const fair =
      plane?.role === 'cargo' ? fairCargoRate(d) : fairPassengerPrice(d)
    applySuggestedPrice(Math.round(fair))
  }

  function applyDestination(destId: string) {
    setToId(destId)
    setError(null)
    setSuccess(null)
    suggestForPair(selectedPlane, fromId, destId)
  }

  function handleFromChange(id: string) {
    setFromId(id)
    setError(null)
    setSuccess(null)
    suggestForPair(selectedPlane, id, toId)
  }

  function handleToChange(id: string) {
    applyDestination(id)
  }

  function handleAircraftChange(id: string) {
    setAircraftInstanceId(id)
    setError(null)
    setSuccess(null)
    const plane = ownedAircraft.find((a) => a.instanceId === id)
    if (fromId && toId) suggestForPair(plane, fromId, toId)
  }

  function validate(): string | null {
    if (gameOver) {
      return 'Game over — restart to open new routes.'
    }
    if (ownedAircraft.length === 0) {
      return 'You need to buy an aircraft first (Market tab).'
    }
    if (!aircraftInstanceId) {
      return 'Select an idle aircraft.'
    }
    if (!selectedPlane) {
      return 'Selected aircraft not found.'
    }
    const alreadyAssigned = routes.some(
      (r) => r.aircraftInstanceId === aircraftInstanceId,
    )
    if (alreadyAssigned) {
      return 'That aircraft is already assigned to another route.'
    }
    if (!fromId) {
      return 'No origin base — set a home hub in Company / setup.'
    }
    if (!toId) {
      return 'Select a destination airport.'
    }
    if (fromId === toId) {
      return 'From and To must be different airports.'
    }
    if (distanceKm === null) {
      return 'Could not compute route distance.'
    }
    const from = airports.find((a) => a.id === fromId)!
    const to = airports.find((a) => a.id === toId)!
    const airportErr = validateRouteAirports(
      selectedPlane,
      from,
      to,
      distanceKm,
    )
    if (airportErr) return airportErr

    // Full uplift required at first departure (one-shot from storage)
    const burn = fuelUpliftForDispatch(
      selectedPlane,
      fromId,
      toId,
      frequency,
    )
    if (fuelStock < burn) {
      return `BBM kurang: butuh ~${formatNumber(Math.round(burn))} L full uplift saat depart — stok ${formatNumber(Math.round(fuelStock))} L.`
    }
    const fee = slotFeeWithHub(from, to, hubId)
    if (cash < fee) {
      return `Slot fee ${formatMoney(fee)} — cash tidak cukup.`
    }
    const price = Number(ticketPrice)
    if (!Number.isFinite(price) || price <= 0) {
      return 'Enter a ticket/cargo rate greater than zero.'
    }
    return null
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSuccess(null)

    const validationError = validate()
    if (validationError) {
      setError(validationError)
      return
    }

    const price = Number(ticketPrice)
    const bp = Number(businessPrice) || price * 2.2
    const fp = Number(firstPrice) || price * 4.5
    const ok = openRoute(
      aircraftInstanceId,
      fromId,
      toId,
      price,
      bp,
      fp,
      frequency,
    )

    if (!ok) {
      // Fallback if store rejects for any reason (race / state edge)
      const plane = useGameStore
        .getState()
        .ownedAircraft.find((a) => a.instanceId === aircraftInstanceId)
      const assigned = useGameStore
        .getState()
        .routes.some((r) => r.aircraftInstanceId === aircraftInstanceId)
      if (assigned) {
        setError('That aircraft is already assigned to another route.')
      } else if (
        plane &&
        distanceKm !== null &&
        effectiveRangeKm(plane) < distanceKm
      ) {
        setError(
          `Range too short: ${plane.model} can fly ${formatNumber(effectiveRangeKm(plane))} km, route is ${formatNumber(Math.round(distanceKm))} km.`,
        )
      } else {
        setError('Could not open route. Check aircraft, airports, and price.')
      }
      return
    }

    setError(null)
    setSuccess('Route opened — plane is parked. Click Fly to depart.')
    setAircraftInstanceId('')
    setFromId(hubId ?? '')
    setToId('')
    setTicketPrice('')
    setBusinessPrice('')
    setFirstPrice('')
    setFrequency(1)
  }

  const selectClass = 'game-input text-sm'

  return (
    <section className="game-panel h-full">
      <header className="game-panel-header">
        <h3 className="game-panel-title">Open route</h3>
      </header>
      <form onSubmit={handleSubmit} className="game-panel-body space-y-2">
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="block space-y-0.5 sm:col-span-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Aircraft (idle)
            </span>
            <select
              className={selectClass}
              value={aircraftInstanceId}
              onChange={(e) => handleAircraftChange(e.target.value)}
            >
              <option value="">
                {idleAircraft.length === 0
                  ? '— No idle aircraft —'
                  : '— Select aircraft —'}
              </option>
              {idleAircraft.map((plane) => (
                <option key={plane.instanceId} value={plane.instanceId}>
                  [{plane.role === 'cargo' ? 'Cargo' : 'Pax'}] {plane.model} ·{' '}
                  {plane.role === 'cargo'
                    ? `${formatNumber(plane.capacity)} t`
                    : `${formatNumber(plane.capacity)} pax`}{' '}
                  · {formatNumber(effectiveRangeKm(plane))} km range
                </option>
              ))}
            </select>
          </label>

          <AirportSelect
            label={hasSecondaryHub ? 'From (your bases)' : 'From (home hub)'}
            value={fromId}
            disabledId={toId}
            onChange={handleFromChange}
            options={originAirports}
            locked={!hasSecondaryHub}
            hint={
              hasSecondaryHub
                ? 'Home hub + airports already on your network.'
                : 'Aircraft base at home hub. Secondary bases unlock after you open more routes.'
            }
          />

          <AirportSelect
            label="To (destination)"
            value={toId}
            disabledId={fromId}
            onChange={handleToChange}
            options={selectedPlane && fromId ? inRangeAirports : undefined}
            placeholder={
              selectedPlane
                ? 'Search in-range destination…'
                : 'Select aircraft first…'
            }
            hint={
              selectedPlane && fromId
                ? `${formatNumber(inRangeList.length)} airports within ${formatNumber(planeRangeKm ?? 0)} km (cabin-adjusted range).`
                : 'Pick an aircraft first — destinations filter by range.'
            }
          />

          {selectedPlane && fromId && (
            <div className="space-y-1 sm:col-span-2">
              <div className="flex flex-wrap items-baseline justify-between gap-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  Suggested
                </span>
                <span className="text-[10px] tabular-nums text-slate-600">
                  {formatNumber(planeRangeKm ?? 0)} km ·{' '}
                  {formatNumber(inRangeList.length)} in reach
                </span>
              </div>
              {routeSuggestions.length === 0 ? (
                <p className="rounded-md border border-amber-500/20 bg-amber-500/5 px-2 py-1 text-[11px] text-amber-200/90">
                  No airports in range for {selectedPlane.model}.
                </p>
              ) : (
                <div className="flex flex-wrap gap-1">
                  {routeSuggestions.map((s) => {
                    const active = toId === s.airport.id
                    const utilPct = Math.round(s.rangeUtil * 100)
                    return (
                      <button
                        key={s.airport.id}
                        type="button"
                        onClick={() => applyDestination(s.airport.id)}
                        className={[
                          'rounded border px-1.5 py-0.5 text-left text-[11px] transition',
                          active
                            ? 'border-sky-500/60 bg-sky-500/15 text-sky-200'
                            : 'border-slate-700 bg-slate-950/70 text-slate-300 hover:border-slate-500',
                        ].join(' ')}
                        title={`${s.airport.city} · sz ${s.airport.size} · ${utilPct}% range`}
                      >
                        <span className="font-bold text-amber-200/90">
                          {s.airport.code}
                        </span>
                        <span className="ml-1 tabular-nums text-slate-500">
                          {formatNumber(Math.round(s.distanceKm))}km
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          <div className="flex flex-wrap gap-x-4 gap-y-1 rounded-md border border-slate-800 bg-slate-950/40 px-2 py-1.5 text-[11px] sm:col-span-2">
            <span className="text-slate-500">
              Dist{' '}
              <span className="font-semibold tabular-nums text-slate-200">
                {distanceKm !== null
                  ? `${formatNumber(Math.round(distanceKm))} km`
                  : '—'}
              </span>
            </span>
            <span className="text-slate-500">
              Fair{' '}
              <span className="font-semibold tabular-nums text-emerald-400">
                {fairPrice !== null ? formatMoney(fairPrice) : '—'}
              </span>
            </span>
            <span className="text-slate-500">
              Range{' '}
              <span
                className={[
                  'font-semibold tabular-nums',
                  planeRangeKm !== null &&
                  distanceKm !== null &&
                  planeRangeKm < distanceKm
                    ? 'text-red-400'
                    : 'text-slate-200',
                ].join(' ')}
              >
                {planeRangeKm !== null
                  ? `${formatNumber(planeRangeKm)} km`
                  : '—'}
              </span>
              {planeRangeKm !== null &&
                distanceKm !== null &&
                planeRangeKm >= distanceKm && (
                  <span className="ml-1 text-slate-600">
                    ({Math.round((distanceKm / planeRangeKm) * 100)}%)
                  </span>
                )}
            </span>
          </div>

          <label className="block space-y-0.5 sm:col-span-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              {isCargo ? 'Cargo $/t' : 'Ticket $/seat'}
            </span>
            <div className="flex flex-wrap items-center gap-1.5">
              <input
                type="number"
                min={1}
                step={1}
                className={selectClass + ' max-w-[8rem]'}
                placeholder={fairPrice !== null ? String(fairPrice) : '150'}
                value={ticketPrice}
                onChange={(e) => {
                  setTicketPrice(e.target.value)
                  setError(null)
                  setSuccess(null)
                }}
              />
              {fairPrice !== null && (
                <button
                  type="button"
                  onClick={() => applySuggestedPrice(fairPrice)}
                  className="rounded border border-slate-700 px-2 py-1 text-[11px] font-medium text-slate-300 hover:bg-slate-800"
                >
                  Fair price
                </button>
              )}
              {!isCargo && selectedPlane && (
                <>
                  <input
                    type="number"
                    min={1}
                    placeholder="J"
                    title="Business"
                    className={selectClass + ' max-w-[5rem]'}
                    value={businessPrice}
                    onChange={(e) => setBusinessPrice(e.target.value)}
                  />
                  <input
                    type="number"
                    min={1}
                    placeholder="F"
                    title="First"
                    className={selectClass + ' max-w-[5rem]'}
                    value={firstPrice}
                    onChange={(e) => setFirstPrice(e.target.value)}
                  />
                </>
              )}
              <select
                className={selectClass + ' max-w-[7rem]'}
                value={frequency}
                onChange={(e) =>
                  setFrequency(Number(e.target.value) as 1 | 2 | 3)
                }
              >
                <option value={1}>1× freq</option>
                <option value={2}>2× freq</option>
                <option value={3}>3× freq</option>
              </select>
            </div>
          </label>

          {fromAirport && toAirport && (
            <p className="text-[10px] text-slate-600 sm:col-span-2">
              Slot{' '}
              <span className="font-mono text-slate-400">
                {formatMoney(slotFeeWithHub(fromAirport, toAirport, hubId))}
              </span>
              {hubId &&
                (fromId === hubId || toId === hubId) &&
                ' (hub −30%)'}
            </p>
          )}
        </div>

        {error && (
          <p
            className="mt-2 rounded-md border border-red-500/30 bg-red-500/10 px-2 py-1 text-[11px] text-red-300"
            role="alert"
          >
            {error}
          </p>
        )}
        {success && (
          <p className="mt-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[11px] text-emerald-300">
            {success}
          </p>
        )}

        <button
          type="submit"
          disabled={gameOver}
          className="btn-game btn-game-primary mt-1 w-full"
        >
          Open route
        </button>
      </form>
    </section>
  )
}

function ActiveRoutesList() {
  const routes = useGameStore((s) => s.routes)
  const ownedAircraft = useGameStore((s) => s.ownedAircraft)
  const activeEvent = useGameStore((s) => s.activeEvent)
  const gameOver = useGameStore((s) => s.gameOver)
  const removeRoute = useGameStore((s) => s.removeRoute)
  const dispatchFlight = useGameStore((s) => s.dispatchFlight)
  const setRouteAutoFly = useGameStore((s) => s.setRouteAutoFly)
  const setRouteSchedule = useGameStore((s) => s.setRouteSchedule)

  return (
    <section className="game-panel h-full">
      <header className="game-panel-header">
        <h3 className="game-panel-title">Active routes</h3>
        <div className="flex items-center gap-2">
          <span className="text-sm tabular-nums text-[var(--game-muted)]">
            {formatNumber(routes.length)}
          </span>
          <FlyAllBar compact />
        </div>
      </header>
      <div className="game-panel-body space-y-1.5">

      {routes.length === 0 ? (
        <EmptyState
          title="No routes yet"
          message="Open a route above to start earning."
          hint={
            ownedAircraft.length === 0
              ? 'Market → buy/rent aircraft first.'
              : 'Pick idle plane + destination + price.'
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-800">
          <table className="w-full min-w-[560px] border-collapse text-left text-xs">
            <thead className="bg-slate-900 text-[10px] uppercase tracking-wider text-slate-500">
              <tr className="border-b border-slate-800">
                <th className="px-2 py-1.5 font-semibold">Flt#</th>
                <th className="px-2 py-1.5 font-semibold">Pair</th>
                <th className="px-2 py-1.5 font-semibold">Aircraft</th>
                <th className="px-2 py-1.5 font-semibold text-right">Km</th>
                <th className="px-2 py-1.5 font-semibold text-right">Price</th>
                <th className="px-2 py-1.5 font-semibold">Status</th>
                <th className="px-2 py-1.5 font-semibold">Auto</th>
                <th className="px-2 py-1.5 font-semibold text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {routes.map((route) => {
                const from = airports.find((a) => a.id === route.fromId)
                const to = airports.find((a) => a.id === route.toId)
                const plane = ownedAircraft.find(
                  (a) => a.instanceId === route.aircraftInstanceId,
                )
                const distanceKm =
                  from && to ? haversineKm(from.coords, to.coords) : 0
                const flight = plane?.flight
                const legFrom = flight
                  ? airports.find((a) => a.id === flight.legFromId)
                  : null
                const legTo = flight
                  ? airports.find((a) => a.id === flight.legToId)
                  : null
                const parked = flight?.status === 'IDLE'
                const airborne = flight?.status === 'IN_FLIGHT'
                const nextLeg =
                  parked && legFrom && legTo
                    ? `${legFrom.code}→${legTo.code}`
                    : airborne && legFrom && legTo
                      ? `${legFrom.code}→${legTo.code}`
                      : `${from?.code ?? '?'}→${to?.code ?? '?'}`

                return (
                  <tr
                    key={route.id}
                    className="bg-slate-900/40 hover:bg-slate-800/50"
                  >
                    <td className="px-2 py-1 font-mono text-[11px] text-sky-300/90">
                      {route.flightNumber ?? '—'}
                    </td>
                    <td className="px-2 py-1 font-semibold text-slate-100">
                      {from?.code ?? '?'}↔{to?.code ?? '?'}
                      <span className="ml-1 font-normal text-slate-500">
                        {from?.city?.split(' ')[0]}–{to?.city?.split(' ')[0]}
                      </span>
                    </td>
                    <td className="px-2 py-1 text-slate-300">
                      {plane?.model ?? '?'}
                      {plane?.role === 'cargo' && (
                        <span className="ml-1 text-[10px] font-bold uppercase text-orange-300">
                          C
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-1 text-right tabular-nums text-slate-400">
                      {formatNumber(Math.round(distanceKm))}
                    </td>
                    <td className="px-2 py-1 text-right tabular-nums text-emerald-400">
                      {formatMoney(route.ticketPrice)}
                    </td>
                    <td className="px-2 py-1 text-slate-400">
                      {formatFlightStatus(flight?.status)}
                      {legFrom && legTo
                        ? ` · ${nextLeg}`
                        : ''}
                    </td>
                    <td className="px-2 py-1">
                      <div className="flex flex-col gap-1">
                        <label
                          className="inline-flex cursor-pointer items-center gap-1 text-xs text-[var(--game-muted)]"
                          title="Auto-depart when parked (uses fuel)"
                        >
                          <input
                            type="checkbox"
                            checked={!!route.autoFly}
                            disabled={gameOver}
                            onChange={(e) =>
                              setRouteAutoFly(route.id, e.target.checked)
                            }
                          />
                          Auto
                        </label>
                        <select
                          className="game-input !w-auto !py-0.5 text-[11px]"
                          disabled={gameOver}
                          title="Queue auto legs after each landing"
                          value={
                            route.scheduleLegsLeft === -1
                              ? '-1'
                              : String(route.scheduleLegsLeft ?? 0)
                          }
                          onChange={(e) =>
                            setRouteSchedule(route.id, Number(e.target.value))
                          }
                        >
                          <option value="0">Sched off</option>
                          <option value="2">2 legs</option>
                          <option value="4">4 legs</option>
                          <option value="8">8 legs</option>
                          <option value="12">12 legs</option>
                          <option value="-1">∞ legs</option>
                        </select>
                      </div>
                    </td>
                    <td className="px-2 py-1 text-right">
                      <div className="inline-flex gap-1">
                        <button
                          type="button"
                          disabled={
                            gameOver ||
                            !parked ||
                            !plane ||
                            !!activeEvent?.groundAll
                          }
                          title={
                            parked
                              ? `Depart ${nextLeg} (needs fuel)`
                              : airborne
                                ? 'Already airborne'
                                : 'Not ready'
                          }
                          onClick={() => {
                            dispatchFlight(route.id)
                          }}
                          className={[
                            'rounded px-2 py-0.5 text-[11px] font-bold',
                            parked && !gameOver
                              ? 'bg-emerald-600 text-white hover:bg-emerald-500'
                              : 'cursor-not-allowed bg-slate-800 text-slate-600',
                          ].join(' ')}
                        >
                          Fly
                        </button>
                        <button
                          type="button"
                          disabled={gameOver}
                          onClick={() => removeRoute(route.id)}
                          className="rounded border border-red-500/25 px-1.5 py-0.5 text-[11px] font-semibold text-red-400 hover:bg-red-500/10 disabled:opacity-40"
                        >
                          ✕
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      </div>
    </section>
  )
}

function formatFlightStatus(status: FlightStatus | undefined): string {
  switch (status) {
    case 'IN_FLIGHT':
      return 'In flight'
    case 'IDLE':
      return 'Parked · click Fly'
    default:
      return '—'
  }
}
