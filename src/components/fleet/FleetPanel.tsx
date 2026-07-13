/**
 * Fleet hangar — aircraft as cards (dense grid).
 */

import { useState } from 'react'
import { formatMoney, formatNumber } from '../../lib/format'
import {
  densityInfo,
  effectiveRangeKm,
  isJumboPassenger,
  maxSeatsFor,
} from '../../sim/cabin'
import { hangarExpandCost } from '../../sim/difficulty'
import {
  isAog,
  repairCost,
  sellValue,
  leaseReturnFee,
} from '../../sim/maintenance'
import { useGameStore } from '../../store/gameStore'
import type { CabinConfig, CabinDensity, OwnedAircraft } from '../../types'
import { AircraftThumb } from '../ui/AircraftThumb'
import { EmptyState } from '../ui/EmptyState'
import { FlyAllBar } from '../ui/FlyAllBar'
import { ScreenHeader } from '../ui/ScreenHeader'

export function FleetPanel() {
  const ownedAircraft = useGameStore((s) => s.ownedAircraft)
  const routes = useGameStore((s) => s.routes)
  const hangarSlots = useGameStore((s) => s.hangarSlots)
  const expandHangar = useGameStore((s) => s.expandHangar)
  const cash = useGameStore((s) => s.cash)

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      <ScreenHeader
        title="✈️ Fleet hangar"
        sub={`${ownedAircraft.length}/${hangarSlots} slots · cabin · repair · Fly`}
        right={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={cash < hangarExpandCost(hangarSlots)}
              onClick={() => expandHangar()}
              className="btn-game btn-game-ghost !text-xs"
              title={`Expand hangar ${formatMoney(hangarExpandCost(hangarSlots))}`}
            >
              +Hangar {formatMoney(hangarExpandCost(hangarSlots))}
            </button>
            <FlyAllBar />
          </div>
        }
      />

      {ownedAircraft.length === 0 ? (
        <div className="col-span-full">
          <EmptyState
            title="Hangar empty"
            message="No planes yet — buy or rent from Hangar market."
            hint="Hangar → perintis: Cessna / Twin Otter"
          />
        </div>
      ) : (
        ownedAircraft.map((plane) => {
          const assigned = routes.some(
            (r) => r.aircraftInstanceId === plane.instanceId,
          )
          return (
            <FleetCard
              key={plane.instanceId}
              plane={plane}
              assigned={assigned}
            />
          )
        })
      )}
    </div>
  )
}

function FleetCard({
  plane,
  assigned,
}: {
  plane: OwnedAircraft
  assigned: boolean
}) {
  const repair = useGameStore((s) => s.repairAircraft)
  const sell = useGameStore((s) => s.sellAircraft)
  const ret = useGameStore((s) => s.returnLease)
  const setCabin = useGameStore((s) => s.setCabinDensity)
  const setCabinLayout = useGameStore((s) => s.setCabinLayout)
  const dispatchFlight = useGameStore((s) => s.dispatchFlight)
  const gameOver = useGameStore((s) => s.gameOver)
  const cash = useGameStore((s) => s.cash)
  const routes = useGameStore((s) => s.routes)
  const route = routes.find((r) => r.aircraftInstanceId === plane.instanceId)
  const [showReconfig, setShowReconfig] = useState(false)

  const aog = isAog(plane)
  const parked = plane.flight?.status === 'IDLE' && !!route
  const statusLabel = aog
    ? 'AOG'
    : !assigned
      ? 'Hangar'
      : plane.flight?.status === 'IN_FLIGHT'
        ? 'In flight'
        : 'Parked'

  const statusClass = aog
    ? 'text-[var(--game-danger)]'
    : plane.flight?.status === 'IN_FLIGHT'
      ? 'text-[var(--game-olive)]'
      : assigned
        ? 'text-[var(--game-cash)]'
        : 'text-[var(--game-brass)]'

  const cond = plane.condition ?? 100
  const condClass =
    cond < 25
      ? 'text-[var(--game-danger)]'
      : cond < 50
        ? 'text-[var(--game-warn)]'
        : 'text-[var(--game-cash)]'
  const cost = repairCost(plane)
  const value = sellValue(plane)
  const retFee = leaseReturnFee(plane)
  const range = effectiveRangeKm(plane)
  const isLeased = plane.ownership === 'LEASED'
  const busy = assigned || plane.flight?.status === 'IN_FLIGHT'
  const canReconfig =
    plane.role === 'passenger' &&
    isJumboPassenger(plane) &&
    plane.flight?.status !== 'IN_FLIGHT' &&
    !gameOver

  return (
    <article className="game-panel flex flex-col">
      <div className="game-panel-body flex flex-1 flex-col gap-2.5">
        <div className="flex items-start gap-2.5">
          <AircraftThumb plane={plane} size="md" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-semibold">{plane.model}</p>
            <p className="text-xs text-[var(--game-dim)]">
              {plane.manufacturer} · {isLeased ? 'Lease' : 'Owned'} ·{' '}
              {plane.role === 'cargo' ? 'Cargo' : 'Pax'}
            </p>
          </div>
          <span
            className={`shrink-0 font-display text-xs font-semibold uppercase ${statusClass}`}
          >
            {statusLabel}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <p className="text-xs text-[var(--game-dim)]">Condition</p>
            <p className={`font-display font-semibold tabular-nums ${condClass}`}>
              {cond.toFixed(0)}%
            </p>
          </div>
          <div>
            <p className="text-xs text-[var(--game-dim)]">Range</p>
            <p className="font-display font-semibold tabular-nums">
              {formatNumber(range)} km
            </p>
          </div>
        </div>

        {plane.role === 'passenger' && (
          <div className="flex flex-wrap items-center gap-1.5">
            <select
              className="game-input !w-auto !py-1 text-xs"
              value={plane.cabin?.density ?? 'standard'}
              disabled={gameOver || plane.flight?.status === 'IN_FLIGHT'}
              onChange={(e) =>
                setCabin(plane.instanceId, e.target.value as CabinDensity)
              }
            >
              {(['dense', 'standard', 'comfort'] as CabinDensity[]).map((d) => (
                <option key={d} value={d}>
                  {densityInfo(d).label}
                </option>
              ))}
            </select>
            {plane.cabin && (
              <span className="text-xs text-[var(--game-dim)]">
                {plane.cabin.economy}Y/{plane.cabin.business}J/
                {plane.cabin.first}F
              </span>
            )}
            {canReconfig && (
              <button
                type="button"
                className="btn-game btn-game-ghost !py-1 !text-xs"
                onClick={() => setShowReconfig((v) => !v)}
              >
                Seats
              </button>
            )}
          </div>
        )}

        {showReconfig && plane.cabin && (
          <CabinReconfigRow
            plane={plane}
            cabin={plane.cabin}
            cash={cash}
            onApply={(c) => {
              if (setCabinLayout(plane.instanceId, c)) setShowReconfig(false)
            }}
            onClose={() => setShowReconfig(false)}
          />
        )}

        <div className="mt-auto flex flex-wrap gap-1.5 border-t border-[rgba(160,145,120,0.12)] pt-2.5">
          {route && (
            <button
              type="button"
              disabled={gameOver || !parked}
              onClick={() => dispatchFlight(route.id)}
              className={[
                'btn-game !py-1.5 !text-xs',
                parked && !gameOver ? 'btn-game-success' : 'btn-game-ghost',
              ].join(' ')}
            >
              Fly
            </button>
          )}
          <button
            type="button"
            disabled={gameOver || cost <= 0 || cash < cost}
            onClick={() => repair(plane.instanceId)}
            className="btn-game btn-game-ghost !py-1.5 !text-xs"
          >
            Fix {cost > 0 ? formatMoney(cost) : 'OK'}
          </button>
          {isLeased ? (
            <button
              type="button"
              disabled={gameOver || busy || cash < retFee}
              onClick={() => {
                if (window.confirm(`Return lease? Fee ${formatMoney(retFee)}`)) {
                  ret(plane.instanceId)
                }
              }}
              className="btn-game btn-game-ghost !py-1.5 !text-xs"
            >
              Return
            </button>
          ) : (
            <button
              type="button"
              disabled={gameOver || busy}
              onClick={() => {
                if (
                  window.confirm(
                    `Sell ${plane.model} for ~${formatMoney(value)}?`,
                  )
                ) {
                  sell(plane.instanceId)
                }
              }}
              className="btn-game btn-game-ghost !py-1.5 !text-xs"
            >
              Sell {formatMoney(value)}
            </button>
          )}
        </div>
      </div>
    </article>
  )
}

function CabinReconfigRow({
  plane,
  cabin,
  cash,
  onApply,
  onClose,
}: {
  plane: OwnedAircraft
  cabin: CabinConfig
  cash: number
  onApply: (c: CabinConfig) => void
  onClose: () => void
}) {
  const [y, setY] = useState(cabin.economy)
  const [j, setJ] = useState(cabin.business)
  const [f, setF] = useState(cabin.first)
  const [density, setDensity] = useState<CabinDensity>(cabin.density)
  const max = maxSeatsFor(plane.capacity, density)
  const total = y + j + f
  const fee = plane.flight ? 12_000 + Math.round(plane.capacity * 40) : 0
  const ok = total > 0 && total <= max && cash >= fee

  return (
    <div className="space-y-1.5 rounded-md border border-[rgba(160,145,120,0.2)] bg-black/20 p-2 text-xs">
      <p className="text-[var(--game-muted)]">
        Max {max} · fee {fee > 0 ? formatMoney(fee) : 'free'}
      </p>
      <div className="flex flex-wrap items-center gap-1.5">
        <select
          className="game-input !w-auto !py-1"
          value={density}
          onChange={(e) => setDensity(e.target.value as CabinDensity)}
        >
          {(['dense', 'standard', 'comfort'] as CabinDensity[]).map((d) => (
            <option key={d} value={d}>
              {densityInfo(d).label}
            </option>
          ))}
        </select>
        {(['Y', 'J', 'F'] as const).map((k, i) => {
          const val = [y, j, f][i]
          const set = [setY, setJ, setF][i]
          return (
            <label key={k} className="flex items-center gap-0.5">
              {k}
              <input
                type="number"
                min={0}
                className="game-input !w-12 !py-1"
                value={val}
                onChange={(e) => set(Number(e.target.value) || 0)}
              />
            </label>
          )
        })}
        <span className={total > max ? 'text-[var(--game-danger)]' : ''}>
          {total}/{max}
        </span>
      </div>
      <div className="flex gap-1">
        <button
          type="button"
          disabled={!ok}
          className="btn-game btn-game-primary !py-1 !text-xs"
          onClick={() =>
            onApply({ density, economy: y, business: j, first: f })
          }
        >
          Apply
        </button>
        <button
          type="button"
          className="btn-game btn-game-ghost !py-1 !text-xs"
          onClick={onClose}
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
