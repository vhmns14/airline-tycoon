/**
 * Map tab — world view + map cargo jobs (OD visible on map).
 */

import { useMemo, useState } from 'react'
import { formatMoney } from '../../lib/format'
import {
  bestFreighterForJob,
  formatCargoEta,
  mapCargoLanes,
} from '../../sim/mapCargo'
import { useGameStore } from '../../store/gameStore'
import { WorldMap, type MapFilterMode } from './WorldMap'

const FILTERS: { id: MapFilterMode; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'network', label: 'Network' },
  { id: 'flying', label: 'Flying' },
  { id: 'cargo', label: 'Cargo' },
  { id: 'hubs', label: 'Hubs' },
]

export function MapPanel() {
  const [filter, setFilter] = useState<MapFilterMode>('all')
  const mapCargoOffers = useGameStore((s) => s.mapCargoOffers)
  const contracts = useGameStore((s) => s.contracts)
  const fleet = useGameStore((s) => s.ownedAircraft)
  const acceptMapCargo = useGameStore((s) => s.acceptMapCargo)
  const [msg, setMsg] = useState<string | null>(null)

  const lanes = useMemo(
    () => mapCargoLanes(mapCargoOffers, contracts),
    [mapCargoOffers, contracts],
  )
  const active = lanes.filter((l) => l.active)
  const offers = lanes.filter((l) => !l.active)

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="min-w-0">
          <h2 className="screen-title">🌍 World map</h2>
          <p className="screen-sub">
            Drag · pinch/scroll zoom · cargo lanes in orange
          </p>
        </div>
        <div className="flex flex-wrap gap-1">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={[
                'btn-game !min-h-[2.5rem] !px-2.5 !py-1.5 !text-xs sm:!px-3',
                filter === f.id ? 'btn-game-primary' : 'btn-game-ghost',
              ].join(' ')}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="game-panel map-panel-frame min-h-[min(52vh,420px)] overflow-hidden !p-0 sm:min-h-[min(70vh,640px)]">
        <WorldMap filterMode={filter} />
      </div>

      {/* Cargo jobs board — always visible so freighter/OD is clear */}
      <div className="game-panel">
        <div className="game-panel-header">
          <h3 className="game-panel-title">📦 Map cargo</h3>
          <span className="text-[10px] text-[var(--game-dim)]">
            Freighter A→B · lump sum on delivery
          </span>
        </div>
        <div className="game-panel-body space-y-3">
          {msg && (
            <p className="text-xs text-[var(--game-olive)]">{msg}</p>
          )}

          {active.length > 0 && (
            <div>
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--game-brass)]">
                Active jobs
              </p>
              <ul className="grid gap-2 sm:grid-cols-2">
                {active.map((l) => {
                  const freighter = bestFreighterForJob(fleet, l.tons)
                  return (
                    <li
                      key={l.id}
                      className="rounded-md border border-orange-500/35 bg-orange-950/20 px-2.5 py-2"
                    >
                      <div className="flex flex-wrap items-baseline justify-between gap-1">
                        <span className="font-display text-sm font-semibold text-orange-200">
                          {l.fromCode} → {l.toCode}
                        </span>
                        <span className="text-sm font-semibold tabular-nums text-[var(--game-cash)]">
                          {formatMoney(l.payout)}
                        </span>
                      </div>
                      <p className="mt-0.5 text-[11px] text-[var(--game-muted)]">
                        {l.fromCity} → {l.toCity} · {l.km} km ·{' '}
                        <strong className="text-orange-200/90">{l.tons}t</strong>
                        {' · '}
                        expires {formatCargoEta(l.endsAt)}
                      </p>
                      <p className="mt-1 text-[10px] text-[var(--game-dim)]">
                        {freighter
                          ? `✓ ${freighter.model} can lift this`
                          : `⚠ Need freighter ≥${l.tons}t (Hangar → cargo)`}
                      </p>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}

          <div>
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--game-dim)]">
              Open offers
            </p>
            {offers.length === 0 ? (
              <p className="text-xs text-[var(--game-dim)]">
                No cargo offers right now — check again shortly.
              </p>
            ) : (
              <ul className="grid gap-2 sm:grid-cols-2">
                {offers.map((l) => {
                  const freighter = bestFreighterForJob(fleet, l.tons)
                  return (
                    <li
                      key={l.id}
                      className="flex flex-col gap-2 rounded-md border border-[rgba(160,145,120,0.18)] bg-black/15 px-2.5 py-2 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                          <span className="font-display text-sm font-semibold">
                            {l.fromCode}→{l.toCode}
                          </span>
                          <span className="text-xs text-[var(--game-muted)]">
                            {l.tons}t · {l.km} km
                          </span>
                          <span className="text-sm font-semibold tabular-nums text-[var(--game-cash)]">
                            {formatMoney(l.payout)}
                          </span>
                        </div>
                        <p className="text-[10px] text-[var(--game-dim)]">
                          {l.fromCity} → {l.toCity} · {formatCargoEta(l.endsAt)} left
                          {freighter
                            ? ` · ${freighter.model.split('(')[0].trim()} OK`
                            : ` · need ≥${l.tons}t freighter`}
                        </p>
                      </div>
                      <button
                        type="button"
                        className="btn-game btn-game-primary !min-h-[2.5rem] !shrink-0 !py-1.5 !text-xs"
                        onClick={() => {
                          const ok = acceptMapCargo(l.id)
                          setMsg(
                            ok
                              ? `Accepted ${l.fromCode}→${l.toCode}. Open a cargo route & Fly.`
                              : 'Max active jobs (4) or invalid offer.',
                          )
                          if (ok) setFilter('cargo')
                        }}
                      >
                        Accept
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
