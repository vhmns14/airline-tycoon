/**
 * Fuel farm — card grid layout.
 */

import { useMemo, useState } from 'react'
import { formatMoney, formatNumber } from '../../lib/format'
import {
  FUEL_PRICE_MAX,
  FUEL_PRICE_MIN,
  fuelUpliftForDispatch,
} from '../../sim/fuel'
import { useGameStore } from '../../store/gameStore'
import { EmptyState } from '../ui/EmptyState'
import { GamePanel } from '../ui/GamePanel'
import { ScreenHeader } from '../ui/ScreenHeader'

const PRESETS = [1_000, 5_000, 10_000, 25_000] as const

export function FuelPanel() {
  const cash = useGameStore((s) => s.cash)
  const fuelStock = useGameStore((s) => s.fuelStock)
  const fuelCapacity = useGameStore((s) => s.fuelCapacity)
  const fuelPriceBase = useGameStore((s) => s.fuelPricePerLiter)
  const activeEvent = useGameStore((s) => s.activeEvent)
  const fuelPrice = fuelPriceBase * (activeEvent?.fuelPriceMult ?? 1)
  const gameOver = useGameStore((s) => s.gameOver)
  const routes = useGameStore((s) => s.routes)
  const ownedAircraft = useGameStore((s) => s.ownedAircraft)
  const buyFuel = useGameStore((s) => s.buyFuel)

  const [customLiters, setCustomLiters] = useState('5000')
  const [msg, setMsg] = useState<string | null>(null)

  const free = Math.max(0, fuelCapacity - fuelStock)
  const fillPct = fuelCapacity > 0 ? (fuelStock / fuelCapacity) * 100 : 0

  const groundedNoFuel = useMemo(() => {
    return ownedAircraft.filter((p) => {
      if (!p.flight || p.flight.status !== 'IDLE') return false
      const route = routes.find((r) => r.aircraftInstanceId === p.instanceId)
      const need = fuelUpliftForDispatch(
        p,
        p.flight.legFromId,
        p.flight.legToId,
        (route?.frequency ?? 1) as 1 | 2 | 3,
      )
      return need > fuelStock
    }).length
  }, [ownedAircraft, fuelStock, routes])

  const sampleBurn = useMemo(() => {
    for (const r of routes) {
      const plane = ownedAircraft.find(
        (a) => a.instanceId === r.aircraftInstanceId,
      )
      if (!plane) continue
      const from = plane.flight?.legFromId ?? r.fromId
      const to = plane.flight?.legToId ?? r.toId
      return Math.round(
        fuelUpliftForDispatch(
          plane,
          from,
          to,
          (r.frequency ?? 1) as 1 | 2 | 3,
        ),
      )
    }
    return null
  }, [routes, ownedAircraft])

  function purchase(liters: number) {
    setMsg(null)
    if (liters <= 0) {
      setMsg('Masukkan jumlah liter > 0.')
      return
    }
    const ok = buyFuel(liters)
    if (!ok) {
      setMsg(
        free <= 0
          ? 'Tangki penuh.'
          : cash < liters * fuelPrice
            ? 'Cash tidak cukup.'
            : 'Gagal beli BBM.',
      )
      return
    }
    const bought = Math.min(liters, free)
    setMsg(
      `Terbeli ${formatNumber(Math.round(bought))} L · ${formatMoney(bought * fuelPrice)}`,
    )
  }

  const custom = Number(customLiters)

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-12">
      <ScreenHeader
        title="⛽ Fuel farm"
        sub="Shared stock · full uplift at depart · price swings"
      />

      <div className="stat-card col-span-1 lg:col-span-3" style={{ ['--card-accent' as string]: '#c4894a' }}>
        <p className="stat-card-label">Stock</p>
        <p className="stat-card-value text-[var(--game-fuel)]">
          {formatNumber(Math.round(fuelStock))} L
        </p>
        <p className="mt-1 text-xs text-[var(--game-dim)]">
          {formatNumber(fuelCapacity)} L cap
        </p>
      </div>
      <div className="stat-card col-span-1 lg:col-span-3" style={{ ['--card-accent' as string]: '#c4a35a' }}>
        <p className="stat-card-label">Price</p>
        <p className="stat-card-value text-[var(--game-brass)]">
          {formatMoney(fuelPrice)}/L
        </p>
        <p className="mt-1 text-xs text-[var(--game-dim)]">
          {formatMoney(FUEL_PRICE_MIN)}–{formatMoney(FUEL_PRICE_MAX)}
        </p>
      </div>
      <div className="stat-card col-span-1 lg:col-span-3" style={{ ['--card-accent' as string]: '#7a8f6a' }}>
        <p className="stat-card-label">Fill cost</p>
        <p className="stat-card-value">{formatMoney(free * fuelPrice)}</p>
        <p className="mt-1 text-xs text-[var(--game-dim)]">
          {formatNumber(Math.round(free))} L free
        </p>
      </div>
      <div className="stat-card col-span-1 lg:col-span-3" style={{ ['--card-accent' as string]: '#8fad7a' }}>
        <p className="stat-card-label">Cash</p>
        <p
          className={[
            'stat-card-value',
            cash >= 0 ? 'text-[var(--game-cash)]' : 'text-[var(--game-danger)]',
          ].join(' ')}
        >
          {formatMoney(cash)}
        </p>
      </div>

      <GamePanel title="Tank level" icon="📊" className="col-span-2 lg:col-span-5">
        <div className="mb-1 flex justify-between text-sm text-[var(--game-muted)]">
          <span>Fill</span>
          <span className="font-display tabular-nums">{fillPct.toFixed(0)}%</span>
        </div>
        <div className="h-2.5 overflow-hidden rounded-full bg-black/40">
          <div
            className="h-full rounded-full transition-[width] duration-300"
            style={{
              width: `${Math.min(100, fillPct)}%`,
              background:
                fillPct < 15
                  ? 'var(--game-danger)'
                  : fillPct < 40
                    ? 'var(--game-warn)'
                    : 'var(--game-cash)',
            }}
          />
        </div>
        {groundedNoFuel > 0 && (
          <p className="mt-2 text-sm text-[var(--game-warn)]">
            {groundedNoFuel} grounded (low fuel)
          </p>
        )}
        {sampleBurn != null && (
          <p className="mt-1 text-sm text-[var(--game-dim)]">
            ~{formatNumber(sampleBurn)} L / next dispatch
          </p>
        )}
      </GamePanel>

      <GamePanel title="Buy fuel" icon="🛒" className="col-span-2 lg:col-span-7">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {PRESETS.map((n) => {
            const cost = n * fuelPrice
            const can =
              !gameOver && free > 0 && cash >= Math.min(n, free) * fuelPrice
            return (
              <button
                key={n}
                type="button"
                disabled={!can}
                onClick={() => purchase(n)}
                className={[
                  'rounded-md border px-2.5 py-2.5 text-left transition',
                  can
                    ? 'border-[rgba(196,137,74,0.35)] bg-[rgba(196,137,74,0.1)] hover:bg-[rgba(196,137,74,0.18)]'
                    : 'cursor-not-allowed border-[rgba(160,145,120,0.12)] opacity-40',
                ].join(' ')}
              >
                <span className="block text-sm font-semibold">
                  +{formatNumber(n)} L
                </span>
                <span className="text-xs text-[var(--game-muted)]">
                  {formatMoney(cost)}
                </span>
              </button>
            )
          })}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            type="number"
            min={1}
            step={100}
            value={customLiters}
            onChange={(e) => setCustomLiters(e.target.value)}
            className="game-input !w-32 text-sm"
            placeholder="Liters"
          />
          <button
            type="button"
            disabled={gameOver || !Number.isFinite(custom) || custom <= 0}
            onClick={() => purchase(custom)}
            className="btn-game btn-game-primary"
          >
            Buy
          </button>
          <button
            type="button"
            disabled={gameOver || free <= 0 || cash < free * fuelPrice}
            onClick={() => purchase(free)}
            className="btn-game btn-game-ghost"
          >
            Fill tank
          </button>
        </div>
        {msg && (
          <p className="mt-2 text-sm text-[var(--game-muted)]" role="status">
            {msg}
          </p>
        )}
      </GamePanel>

      {ownedAircraft.length === 0 && (
        <div className="col-span-full">
          <EmptyState
            title="No fleet"
            message="Hangar → rent a plane, then buy fuel here."
          />
        </div>
      )}
    </div>
  )
}
