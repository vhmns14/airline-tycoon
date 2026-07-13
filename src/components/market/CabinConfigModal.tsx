/**
 * Cabin configurator — opens after Buy/Rent on jet airliners.
 * Price updates live from Y/J/F + density mix.
 */

import { useEffect, useMemo, useState } from 'react'
import {
  cabinFromClasses,
  cabinLeasePrice,
  cabinPurchasePrice,
  defaultCabin,
  maxSeatsFor,
  setClassSeats,
  totalSeats,
} from '../../sim/cabin'
import { formatMoney, formatNumber } from '../../lib/format'
import type { Aircraft, CabinConfig, CabinDensity } from '../../types'
import { CabinSeatMap } from '../ui/CabinSeatMap'
import { AircraftThumb } from '../ui/AircraftThumb'

type Mode = 'buy' | 'rent'

type CabinConfigModalProps = {
  plane: Aircraft
  mode: Mode
  cash: number
  onConfirm: (cabin: CabinConfig, price: number) => void
  onCancel: () => void
}

export function CabinConfigModal({
  plane,
  mode,
  cash,
  onConfirm,
  onCancel,
}: CabinConfigModalProps) {
  const [density, setDensity] = useState<CabinDensity>('standard')
  const [cabin, setCabin] = useState<CabinConfig>(() =>
    defaultCabin(plane.capacity, 'standard'),
  )

  useEffect(() => {
    setCabin(defaultCabin(plane.capacity, density))
  }, [density, plane.capacity])

  const max = maxSeatsFor(plane.capacity, density)

  const livePrice = useMemo(() => {
    if (mode === 'buy') {
      return cabinPurchasePrice(plane.price, cabin, plane.capacity)
    }
    return cabinLeasePrice(plane.dailyLeaseCost, cabin, plane.capacity)
  }, [mode, plane.price, plane.dailyLeaseCost, plane.capacity, cabin])

  const baseRef =
    mode === 'buy' ? plane.price : plane.dailyLeaseCost
  const delta = livePrice - baseRef
  const canAfford = mode === 'rent' || cash >= livePrice

  function setClass(which: 'economy' | 'business' | 'first', value: number) {
    setCabin((c) => setClassSeats(c, plane.capacity, which, value))
  }

  function preset(y: number, j: number, f: number) {
    setCabin(cabinFromClasses(plane.capacity, y, j, f, density))
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-3 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cabin-config-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel()
      }}
    >
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-600 bg-slate-900 p-4 shadow-2xl">
        <div className="mb-3 flex items-start gap-3">
          <AircraftThumb plane={plane} size="lg" />
          <div className="min-w-0 flex-1">
            <h2
              id="cabin-config-title"
              className="text-base font-bold text-slate-100"
            >
              Konfigurasi kursi
            </h2>
            <p className="text-sm text-slate-300">{plane.model}</p>
            <p className="text-[11px] text-slate-500">
              Max {formatNumber(max)} seats · atur First / Business / Economy
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg px-2 py-1 text-slate-500 hover:bg-slate-800 hover:text-slate-200"
          >
            ✕
          </button>
        </div>

        {/* Live price */}
        <div className="mb-3 rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            {mode === 'buy' ? 'Harga beli' : 'Sewa / hari'}
          </p>
          <p className="text-xl font-bold tabular-nums text-emerald-400">
            {formatMoney(livePrice)}
          </p>
          <p className="text-[11px] tabular-nums text-slate-500">
            Catalog {formatMoney(baseRef)}
            {delta !== 0 && (
              <span
                className={
                  delta > 0 ? ' text-amber-300' : ' text-sky-300'
                }
              >
                {' '}
                ({delta > 0 ? '+' : ''}
                {formatMoney(delta)} dari layout)
              </span>
            )}
          </p>
        </div>

        <div className="mb-3 flex flex-wrap gap-1.5">
          {(['dense', 'standard', 'comfort'] as CabinDensity[]).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDensity(d)}
              className={[
                'rounded-md px-2.5 py-1 text-[11px] font-semibold capitalize',
                density === d
                  ? 'bg-sky-600 text-white'
                  : 'border border-slate-700 text-slate-400 hover:bg-slate-800',
              ].join(' ')}
            >
              {d}
            </button>
          ))}
        </div>

        <div className="mb-3 flex flex-wrap gap-1">
          <PresetBtn
            label="All economy"
            onClick={() => preset(max, 0, 0)}
          />
          <PresetBtn
            label="Standard"
            onClick={() => setCabin(defaultCabin(plane.capacity, density))}
          />
          <PresetBtn
            label="Biz heavy"
            onClick={() =>
              preset(
                Math.round(max * 0.55),
                Math.round(max * 0.35),
                Math.round(max * 0.1),
              )
            }
          />
          <PresetBtn
            label="Premium"
            onClick={() =>
              preset(
                Math.round(max * 0.5),
                Math.round(max * 0.3),
                Math.round(max * 0.2),
              )
            }
          />
        </div>

        <div className="mb-3 space-y-2.5">
          <ClassSlider
            label="First"
            color="text-amber-300"
            value={cabin.first}
            max={max}
            onChange={(v) => setClass('first', v)}
          />
          <ClassSlider
            label="Business"
            color="text-violet-300"
            value={cabin.business}
            max={max}
            onChange={(v) => setClass('business', v)}
          />
          <ClassSlider
            label="Economy"
            color="text-sky-300"
            value={cabin.economy}
            max={max}
            onChange={(v) => setClass('economy', v)}
          />
          <p className="text-[10px] text-slate-600">
            Total {totalSeats(cabin)} / {max}. First & Business menaikkan harga;
            dense lebih murah, comfort lebih mahal.
          </p>
        </div>

        <CabinSeatMap key={`${cabin.first}-${cabin.business}-${cabin.economy}-${density}`} cabin={cabin} animate />

        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-slate-600 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-800"
          >
            Batal
          </button>
          <button
            type="button"
            disabled={!canAfford}
            onClick={() => onConfirm(cabin, livePrice)}
            className="rounded-lg bg-sky-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-sky-500 disabled:cursor-not-allowed disabled:bg-slate-700"
          >
            {mode === 'buy'
              ? `Beli · ${formatMoney(livePrice)}`
              : `Sewa · ${formatMoney(livePrice)}/hari`}
          </button>
        </div>
        {!canAfford && mode === 'buy' && (
          <p className="mt-2 text-center text-[11px] text-red-400">
            Cash kurang untuk layout ini
          </p>
        )}
      </div>
    </div>
  )
}

/** Jet airliners open this modal; small props skip. */
export function needsCabinConfig(plane: Aircraft): boolean {
  return plane.role === 'passenger' && (
    plane.bodyClass === 'regional' ||
    plane.bodyClass === 'narrowbody' ||
    plane.bodyClass === 'widebody' ||
    plane.bodyClass === 'super' ||
    plane.capacity >= 50
  )
}

function ClassSlider({
  label,
  color,
  value,
  max,
  onChange,
}: {
  label: string
  color: string
  value: number
  max: number
  onChange: (v: number) => void
}) {
  return (
    <label className="block">
      <div className="mb-0.5 flex justify-between text-[11px]">
        <span className={`font-semibold ${color}`}>{label}</span>
        <span className="tabular-nums text-slate-300">{value}</span>
      </div>
      <input
        type="range"
        min={0}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-sky-500"
      />
    </label>
  )
}

function PresetBtn({
  label,
  onClick,
}: {
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded border border-slate-700 px-2 py-0.5 text-[10px] text-slate-400 hover:border-slate-500 hover:text-slate-200"
    >
      {label}
    </button>
  )
}
