/**
 * Animated cabin seat map for jumbo Y / J / F configuration.
 */

import { useMemo } from 'react'
import type { CabinConfig } from '../../types'
import { totalSeats } from '../../sim/cabin'

type CabinSeatMapProps = {
  cabin: CabinConfig
  /** Animate layout changes */
  animate?: boolean
  className?: string
}

const CLASS_STYLE = {
  first: 'bg-amber-400/90 ring-amber-200/40',
  business: 'bg-violet-400/85 ring-violet-200/30',
  economy: 'bg-sky-500/70 ring-sky-300/20',
} as const

/**
 * Build a visual seat list: F then J then Y, with aisle gaps every 3–4 seats.
 */
function buildSeatCells(cabin: CabinConfig) {
  type Cell =
    | { kind: 'seat'; cls: 'first' | 'business' | 'economy'; i: number }
    | { kind: 'aisle' }
    | { kind: 'gap' }

  const cells: Cell[] = []
  let n = 0
  const pushBlock = (count: number, cls: 'first' | 'business' | 'economy') => {
    for (let i = 0; i < count; i++) {
      cells.push({ kind: 'seat', cls, i: n++ })
      // aisle every 3 seats in a row group
      if ((i + 1) % 3 === 0 && i + 1 < count) {
        cells.push({ kind: 'aisle' })
      }
    }
  }

  if (cabin.first > 0) {
    pushBlock(cabin.first, 'first')
    cells.push({ kind: 'gap' })
  }
  if (cabin.business > 0) {
    pushBlock(cabin.business, 'business')
    cells.push({ kind: 'gap' })
  }
  pushBlock(cabin.economy, 'economy')
  return cells
}

export function CabinSeatMap({
  cabin,
  animate = true,
  className = '',
}: CabinSeatMapProps) {
  const cells = useMemo(() => buildSeatCells(cabin), [cabin])
  const total = totalSeats(cabin)

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex flex-wrap items-center gap-3 text-[10px] text-slate-500">
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-sm bg-amber-400" /> First {cabin.first}
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-sm bg-violet-400" /> Biz {cabin.business}
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-sm bg-sky-500" /> Eco {cabin.economy}
        </span>
        <span className="ml-auto tabular-nums text-slate-400">
          {total} seats
        </span>
      </div>

      {/* Fuselage frame */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-700 bg-gradient-to-b from-slate-900 to-slate-950 px-3 py-3">
        {/* Nose / tail cues */}
        <div className="pointer-events-none absolute left-1 top-1/2 h-8 w-3 -translate-y-1/2 rounded-l-full bg-slate-800" />
        <div className="pointer-events-none absolute right-1 top-1/2 h-6 w-2 -translate-y-1/2 rounded-r-sm bg-slate-800" />

        <div className="flex max-h-40 flex-wrap content-start gap-0.5 overflow-y-auto pl-3 pr-2">
          {cells.map((c, idx) => {
            if (c.kind === 'aisle') {
              return (
                <span
                  key={`a-${idx}`}
                  className="h-2.5 w-1.5 shrink-0"
                  aria-hidden
                />
              )
            }
            if (c.kind === 'gap') {
              return (
                <span
                  key={`g-${idx}`}
                  className="h-2.5 w-full basis-full border-t border-dashed border-slate-700/80 py-0.5"
                  aria-hidden
                />
              )
            }
            return (
              <span
                key={`${c.cls}-${c.i}-${cabin.first}-${cabin.business}-${cabin.economy}`}
                title={c.cls}
                className={[
                  'inline-block h-2.5 w-2.5 shrink-0 rounded-[2px] ring-1',
                  CLASS_STYLE[c.cls],
                  animate ? 'cabin-seat-pop' : '',
                ].join(' ')}
                style={
                  animate
                    ? { animationDelay: `${Math.min(c.i, 80) * 8}ms` }
                    : undefined
                }
              />
            )
          })}
        </div>
      </div>
    </div>
  )
}
