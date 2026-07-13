/**
 * Market: manufacturers → models + used listings.
 */

import { useEffect, useMemo, useState } from 'react'
import {
  byManufacturer,
  manufacturers,
  type ManufacturerInfo,
} from '../../data/aircraft'
import { isJumboPassenger } from '../../sim/cabin'
import { formatMoney, formatNumber } from '../../lib/format'
import {
  getUsedListings,
  useGameStore,
} from '../../store/gameStore'
import type { Aircraft, CabinConfig } from '../../types'
import { AircraftThumb } from '../ui/AircraftThumb'
import { CabinConfigModal, needsCabinConfig } from './CabinConfigModal'

type RoleFilter = 'all' | 'passenger' | 'cargo'
type Pending = { plane: Aircraft; mode: 'buy' | 'rent' }

export function MarketPanel() {
  const cash = useGameStore((s) => s.cash)
  const gameOver = useGameStore((s) => s.gameOver)
  const fleetLen = useGameStore((s) => s.ownedAircraft.length)
  const hangarSlots = useGameStore((s) => s.hangarSlots)
  const buyAircraft = useGameStore((s) => s.buyAircraft)
  const leaseAircraft = useGameStore((s) => s.leaseAircraft)
  const buyUsedAircraft = useGameStore((s) => s.buyUsedAircraft)
  const refreshUsedMarket = useGameStore((s) => s.refreshUsedMarket)

  const [maker, setMaker] = useState<string | null>(null)
  const [role, setRole] = useState<RoleFilter>('all')
  const [msg, setMsg] = useState<string | null>(null)
  const [pending, setPending] = useState<Pending | null>(null)
  const [usedTick, setUsedTick] = useState(0)

  useEffect(() => {
    if (usedTick === 0) refreshUsedMarket()
  }, [usedTick, refreshUsedMarket])

  const usedList = useMemo(() => getUsedListings(), [usedTick])

  const makers = useMemo(() => manufacturers(), [])

  const models = useMemo(() => {
    if (!maker) return []
    let list = byManufacturer(maker)
    if (role === 'passenger') list = list.filter((a) => a.role === 'passenger')
    if (role === 'cargo') list = list.filter((a) => a.role === 'cargo')
    return list
  }, [maker, role])

  function finish(
    plane: Aircraft,
    mode: 'buy' | 'rent',
    cabin?: CabinConfig,
    price?: number,
  ) {
    setMsg(null)
    if (fleetLen >= hangarSlots) {
      setMsg(`Hangar penuh (${fleetLen}/${hangarSlots}) — expand di Fleet/Company`)
      setPending(null)
      return
    }
    if (mode === 'buy') {
      const ok = buyAircraft(plane.id, cabin ?? null, price)
      setMsg(
        ok
          ? `Bought ${plane.model}${price ? ` · ${formatMoney(price)}` : ''}`
          : `Gagal beli ${plane.model} (cash?)`,
      )
    } else {
      const ok = leaseAircraft(plane.id, cabin ?? null, price)
      setMsg(ok ? `Rented ${plane.model}` : `Gagal sewa ${plane.model}`)
    }
    setPending(null)
  }

  function handleBuy(plane: Aircraft) {
    // Always open seat config for configurable jets
    if (needsCabinConfig(plane)) {
      setPending({ plane, mode: 'buy' })
      return
    }
    finish(plane, 'buy')
  }

  function handleRent(plane: Aircraft) {
    if (needsCabinConfig(plane)) {
      setPending({ plane, mode: 'rent' })
      return
    }
    finish(plane, 'rent')
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="screen-title">🛒 Aircraft market</h2>
          <p className="screen-sub">
            Jets: set cabin Y/J/F (price adjusts). Small props: buy direct.
          </p>
        </div>
        <span className="hud-chip font-display text-sm tabular-nums text-[var(--game-cash)]">
          💵 {formatMoney(cash)} · hangar {fleetLen}/{hangarSlots}
        </span>
      </div>

      {msg && (
        <p className="text-sm text-[var(--game-muted)]" role="status">
          {msg}
        </p>
      )}

      {!maker ? (
        <>
          <ManufacturerGrid
            makers={makers}
            onSelect={(name) => {
              setMaker(name)
              setRole('all')
              setMsg(null)
            }}
          />
          <div className="mt-4">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-display text-sm font-semibold uppercase tracking-wide text-[var(--game-brass)]">
                Used market
              </h3>
              <button
                type="button"
                className="btn-game btn-game-ghost !text-xs"
                onClick={() => {
                  refreshUsedMarket()
                  setUsedTick((t) => t + 1)
                }}
              >
                Refresh listings
              </button>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {usedList.map((u) => (
                <div key={u.id} className="game-panel">
                  <div className="game-panel-body">
                    <p className="font-semibold">{u.model}</p>
                    <p className="text-xs text-[var(--game-dim)]">
                      {u.manufacturer} · cond {u.condition}% · ~
                      {Math.round(u.hours)}h
                    </p>
                    <p className="mt-1 font-display text-[var(--game-cash)]">
                      {formatMoney(u.price)}
                    </p>
                    <button
                      type="button"
                      disabled={
                        gameOver || cash < u.price || fleetLen >= hangarSlots
                      }
                      className="btn-game btn-game-primary mt-2 !text-xs"
                      onClick={() => {
                        const ok = buyUsedAircraft(u.id)
                        setUsedTick((t) => t + 1)
                        setMsg(
                          ok
                            ? `Bought used ${u.model}`
                            : 'Failed (cash / hangar).',
                        )
                      }}
                    >
                      Buy used
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : (
        <ManufacturerModels
          maker={maker}
          models={models}
          role={role}
          cash={cash}
          gameOver={gameOver}
          onRole={setRole}
          onBack={() => setMaker(null)}
          onBuy={handleBuy}
          onRent={handleRent}
        />
      )}

      {pending && (
        <CabinConfigModal
          plane={pending.plane}
          mode={pending.mode}
          cash={cash}
          onCancel={() => setPending(null)}
          onConfirm={(cabin, price) =>
            finish(pending.plane, pending.mode, cabin, price)
          }
        />
      )}
    </div>
  )
}

function ManufacturerGrid({
  makers,
  onSelect,
}: {
  makers: ManufacturerInfo[]
  onSelect: (name: string) => void
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {makers.map((m) => {
        const sample = byManufacturer(m.name)[0]
        return (
          <button
            key={m.name}
            type="button"
            onClick={() => onSelect(m.name)}
            className="game-panel group flex items-center gap-3 px-3 py-3 text-left transition hover:border-[rgba(196,163,90,0.35)]"
          >
            <span
              className="flex h-10 w-[4.5rem] shrink-0 items-center justify-center overflow-hidden rounded-md ring-1 ring-slate-700"
              style={{ background: `${m.color}18` }}
            >
              {sample ? (
                <AircraftThumb plane={sample} size="md" />
              ) : (
                <span className="text-lg font-bold" style={{ color: m.color }}>
                  {m.name[0]}
                </span>
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold text-slate-100 group-hover:text-white">
                {m.name}
              </span>
              <span className="block text-[10px] text-slate-500">
                {m.country} · {m.count} type{m.count === 1 ? '' : 's'}
              </span>
              <span className="mt-0.5 block text-[10px] text-slate-600">
                from {formatMoney(m.minPrice)}
              </span>
            </span>
            <span className="text-slate-600 group-hover:text-sky-400">›</span>
          </button>
        )
      })}
    </div>
  )
}

function ManufacturerModels({
  maker,
  models,
  role,
  cash,
  gameOver,
  onRole,
  onBack,
  onBuy,
  onRent,
}: {
  maker: string
  models: Aircraft[]
  role: RoleFilter
  cash: number
  gameOver: boolean
  onRole: (r: RoleFilter) => void
  onBack: () => void
  onBuy: (plane: Aircraft) => void
  onRent: (plane: Aircraft) => void
}) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onBack}
          className="rounded-md border border-slate-700 px-2 py-1 text-[11px] font-semibold text-slate-300 hover:bg-slate-800"
        >
          ← Makers
        </button>
        <h3 className="text-sm font-bold text-slate-100">{maker}</h3>
        <div className="flex gap-1">
          {(
            [
              ['all', 'All'],
              ['passenger', 'Pax'],
              ['cargo', 'Cargo'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => onRole(id)}
              className={[
                'rounded px-1.5 py-0.5 text-[10px] font-semibold',
                role === id
                  ? 'bg-sky-600 text-white'
                  : 'border border-slate-700 text-slate-500 hover:bg-slate-800',
              ].join(' ')}
            >
              {label}
            </button>
          ))}
        </div>
        <span className="ml-auto text-[10px] text-slate-600">
          {formatNumber(models.length)} models
        </span>
      </div>

      {models.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-700 px-3 py-4 text-center text-xs text-slate-500">
          No {role} types for {maker}.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-800">
          <table className="w-full min-w-[720px] border-collapse text-left text-xs">
            <thead className="bg-slate-900 text-[10px] uppercase tracking-wider text-slate-500">
              <tr className="border-b border-slate-800">
                <th className="px-2 py-1.5 font-semibold">Model</th>
                <th className="px-2 py-1.5 font-semibold text-right">Cap</th>
                <th className="px-2 py-1.5 font-semibold text-right">Range</th>
                <th className="px-2 py-1.5 font-semibold text-right">Cruise</th>
                <th className="px-2 py-1.5 font-semibold text-right">Price</th>
                <th className="px-2 py-1.5 font-semibold text-right">Lease/d</th>
                <th className="px-2 py-1.5 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {models.map((item) => {
                const canBuy = cash >= item.price && !gameOver
                const canRent = !gameOver
                const isCargo = item.role === 'cargo'
                const jumbo = isJumboPassenger(item)
                return (
                  <tr
                    key={item.id}
                    className="bg-slate-900/40 hover:bg-slate-800/50"
                  >
                    <td className="px-2 py-1">
                      <div className="flex items-center gap-2.5">
                        <AircraftThumb plane={item} size="md" />
                        <div className="min-w-0">
                          <p className="font-medium text-slate-100">
                            {item.model}
                            {jumbo && (
                              <span className="ml-1.5 rounded bg-amber-500/15 px-1 text-[9px] font-bold uppercase text-amber-300">
                                Seat config
                              </span>
                            )}
                          </p>
                          <p className="text-[10px] text-slate-600">
                            {isCargo ? 'Cargo' : 'Passenger'} · {item.bodyClass}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-2 py-1 text-right tabular-nums text-slate-300">
                      {isCargo
                        ? `${formatNumber(item.capacity)}t`
                        : formatNumber(item.capacity)}
                    </td>
                    <td className="px-2 py-1 text-right tabular-nums text-slate-300">
                      {formatNumber(item.rangeKm)}
                    </td>
                    <td className="px-2 py-1 text-right tabular-nums text-slate-400">
                      {formatNumber(item.speedKmh)}
                    </td>
                    <td className="px-2 py-1 text-right tabular-nums text-slate-200">
                      {formatMoney(item.price)}
                    </td>
                    <td className="px-2 py-1 text-right tabular-nums text-violet-300/90">
                      {formatMoney(item.dailyLeaseCost)}
                    </td>
                    <td className="px-2 py-1 text-right">
                      <div className="inline-flex gap-1">
                        <button
                          type="button"
                          disabled={!canBuy}
                          onClick={() => onBuy(item)}
                          className={[
                            'rounded px-2 py-0.5 text-[11px] font-bold',
                            canBuy
                              ? 'bg-sky-600 text-white hover:bg-sky-500'
                              : 'cursor-not-allowed bg-slate-800 text-slate-600',
                          ].join(' ')}
                        >
                          Buy
                        </button>
                        <button
                          type="button"
                          disabled={!canRent}
                          onClick={() => onRent(item)}
                          className={[
                            'rounded px-2 py-0.5 text-[11px] font-bold',
                            canRent
                              ? 'bg-violet-600 text-white hover:bg-violet-500'
                              : 'cursor-not-allowed bg-slate-800 text-slate-600',
                          ].join(' ')}
                        >
                          Rent
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
  )
}
