/**
 * Pick which freighter runs a map cargo job — Accept opens this.
 */

import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { formatMoney } from '../../lib/format'
import {
  formatCargoEta,
  freighterPicksForJob,
  type MapCargoLane,
} from '../../sim/mapCargo'
import { useGameStore } from '../../store/gameStore'
import { AircraftThumb } from '../ui/AircraftThumb'

type Props = {
  lane: MapCargoLane
  onClose: () => void
  onDone: (msg: string) => void
}

export function MapCargoAssignModal({ lane, onClose, onDone }: Props) {
  const fleet = useGameStore((s) => s.ownedAircraft)
  const routes = useGameStore((s) => s.routes)
  const cash = useGameStore((s) => s.cash)
  const fuelStock = useGameStore((s) => s.fuelStock)
  const acceptMapCargo = useGameStore((s) => s.acceptMapCargo)

  const picks = useMemo(
    () => freighterPicksForJob(fleet, routes, lane.tons, lane.fromId),
    [fleet, routes, lane.tons, lane.fromId],
  )

  const selectable = picks.filter((p) => p.selectable)
  const [selectedId, setSelectedId] = useState<string | null>(
    () => selectable[0]?.plane.instanceId ?? null,
  )

  // Keep selection valid if fleet updates
  useEffect(() => {
    if (
      selectedId &&
      selectable.some((p) => p.plane.instanceId === selectedId)
    ) {
      return
    }
    setSelectedId(selectable[0]?.plane.instanceId ?? null)
  }, [selectable, selectedId])

  // Esc to close
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const selected = picks.find((p) => p.plane.instanceId === selectedId)

  function run(dispatchNow: boolean) {
    if (!selectedId) return
    const ok = acceptMapCargo(lane.id, selectedId, dispatchNow)
    if (ok) {
      onDone(
        dispatchNow
          ? `${lane.fromCode}→${lane.toCode} assigned & departed.`
          : `${lane.fromCode}→${lane.toCode} assigned — freighter ready at ${lane.fromCode}.`,
      )
      onClose()
    } else {
      onDone('Could not assign — check cash, fuel, range, or freighter status.')
    }
  }

  const body = (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center sm:p-4"
      role="dialog"
      aria-modal
      aria-labelledby="cargo-assign-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/60"
        aria-label="Close"
        onClick={onClose}
      />
      <div
        className="relative z-10 flex max-h-[min(88vh,640px)] w-full max-w-lg flex-col rounded-t-2xl border border-orange-500/30 bg-[#1a1714] shadow-2xl sm:rounded-2xl"
        style={{
          paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))',
        }}
      >
        <div className="border-b border-[rgba(160,145,120,0.18)] px-4 pb-3 pt-3">
          <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-[rgba(160,145,120,0.35)] sm:hidden" />
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-orange-300/90">
            Assign freighter
          </p>
          <h2
            id="cargo-assign-title"
            className="font-display text-lg font-semibold text-[var(--game-text)]"
          >
            {lane.fromCode} → {lane.toCode}
          </h2>
          <p className="mt-0.5 text-xs text-[var(--game-muted)]">
            {lane.fromCity} → {lane.toCity} · {lane.tons}t · {lane.km} km ·{' '}
            <span className="font-semibold text-[var(--game-cash)]">
              {formatMoney(lane.payout)}
            </span>
            {' · '}
            {formatCargoEta(lane.endsAt)} left
          </p>
          <p className="mt-1 text-[10px] text-[var(--game-dim)]">
            Cash {formatMoney(cash)} · Fuel {Math.round(fuelStock).toLocaleString()}{' '}
            L · plane repositions to pickup free
          </p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
          {picks.length === 0 ? (
            <div className="rounded-lg border border-dashed border-[rgba(160,145,120,0.25)] px-3 py-6 text-center">
              <p className="text-sm text-[var(--game-muted)]">
                No freighters in fleet
              </p>
              <p className="mt-1 text-xs text-[var(--game-dim)]">
                Hangar → filter Cargo · buy/lease a freighter ≥{lane.tons}t
              </p>
            </div>
          ) : (
            <ul className="space-y-1.5">
              {picks.map((p) => {
                const active = p.plane.instanceId === selectedId
                return (
                  <li key={p.plane.instanceId}>
                    <button
                      type="button"
                      disabled={!p.selectable}
                      onClick={() => setSelectedId(p.plane.instanceId)}
                      className={[
                        'flex w-full items-center gap-2.5 rounded-xl border px-2.5 py-2 text-left transition',
                        !p.selectable
                          ? 'cursor-not-allowed border-transparent bg-black/10 opacity-45'
                          : active
                            ? 'border-orange-400/55 bg-orange-950/35'
                            : 'border-[rgba(160,145,120,0.15)] bg-black/20 hover:border-orange-500/30',
                      ].join(' ')}
                    >
                      <span
                        className={[
                          'flex h-4 w-4 shrink-0 items-center justify-center rounded-full border text-[9px]',
                          active
                            ? 'border-orange-300 bg-orange-400 text-[#1a1714]'
                            : 'border-[rgba(160,145,120,0.35)]',
                        ].join(' ')}
                        aria-hidden
                      >
                        {active ? '✓' : ''}
                      </span>
                      <AircraftThumb plane={p.plane} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-[var(--game-text)]">
                          {p.plane.model}
                        </p>
                        <p className="text-[10px] text-[var(--game-muted)]">
                          {p.plane.capacity}t cap · now {p.locationCode}
                          {p.atPickup ? ' · at pickup' : ''}
                        </p>
                        {p.reason && (
                          <p
                            className={[
                              'text-[10px]',
                              p.selectable
                                ? 'text-[var(--game-dim)]'
                                : 'text-[var(--game-warn)]',
                            ].join(' ')}
                          >
                            {p.reason}
                          </p>
                        )}
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <div className="flex flex-col gap-2 border-t border-[rgba(160,145,120,0.15)] px-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[10px] text-[var(--game-dim)] sm:max-w-[45%]">
            {selected
              ? `${selected.plane.model.split('(')[0].trim()} · route opens ${lane.fromCode}→${lane.toCode}`
              : 'Select a freighter'}
          </p>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              className="btn-game btn-game-ghost !min-h-[2.6rem] !flex-1 sm:!flex-none"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!selectedId}
              className="btn-game btn-game-primary !min-h-[2.6rem] !flex-1 sm:!flex-none"
              onClick={() => run(false)}
            >
              Assign
            </button>
            <button
              type="button"
              disabled={!selectedId}
              className="btn-game btn-game-success !min-h-[2.6rem] !flex-1 sm:!flex-none"
              onClick={() => run(true)}
              title="Assign and depart now if fuel allows"
            >
              Assign & Fly
            </button>
          </div>
        </div>
      </div>
    </div>
  )

  return createPortal(body, document.body)
}
