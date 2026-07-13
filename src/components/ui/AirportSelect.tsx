/**
 * Compact searchable airport picker.
 */

import { useMemo, useState } from 'react'
import { airports as allAirports } from '../../data/airports'
import type { Airport } from '../../types'

type AirportSelectProps = {
  value: string
  onChange: (airportId: string) => void
  disabledId?: string
  label: string
  placeholder?: string
  options?: Airport[]
  locked?: boolean
  hint?: string
}

export function AirportSelect({
  value,
  onChange,
  disabledId,
  label,
  placeholder = 'Search…',
  options,
  locked = false,
  hint,
}: AirportSelectProps) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)

  const catalog = options ?? allAirports
  const selected = allAirports.find((a) => a.id === value)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    let list = catalog.filter((a) => a.id !== disabledId)
    if (q) {
      list = list.filter(
        (a) =>
          a.code.toLowerCase().includes(q) ||
          a.city.toLowerCase().includes(q) ||
          a.id.toLowerCase().includes(q),
      )
    }
    return list
      .slice()
      .sort((a, b) => b.size - a.size || a.code.localeCompare(b.code))
      .slice(0, 80)
  }, [query, disabledId, catalog])

  function pick(a: Airport) {
    onChange(a.id)
    setQuery('')
    setOpen(false)
  }

  if (locked) {
    return (
      <div className="block">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          {label}
        </span>
        <div className="mt-0.5 flex w-full items-center justify-between rounded-md border border-slate-700/80 bg-slate-950/80 px-2 py-1.5 text-left text-xs text-slate-100">
          <span>
            {selected ? (
              <>
                <span className="font-bold text-amber-200/90">{selected.code}</span>
                <span className="text-slate-500"> {selected.city}</span>
              </>
            ) : (
              <span className="text-slate-500">No hub</span>
            )}
          </span>
          <span className="rounded bg-sky-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase text-sky-300">
            Hub
          </span>
        </div>
        {hint && <p className="mt-0.5 text-[10px] text-slate-600">{hint}</p>}
      </div>
    )
  }

  return (
    <div className="relative block">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </span>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="mt-0.5 flex w-full items-center justify-between rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-left text-xs text-slate-100"
      >
        <span className={selected ? '' : 'text-slate-500'}>
          {selected
            ? `${selected.code} — ${selected.city} (sz ${selected.size})`
            : '— Select —'}
        </span>
        <span className="text-slate-500">▾</span>
      </button>
      {hint && !open && (
        <p className="mt-0.5 text-[10px] text-slate-600">{hint}</p>
      )}

      {open && (
        <div className="absolute z-30 mt-0.5 w-full overflow-hidden rounded-md border border-slate-600 bg-slate-900 shadow-xl">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={placeholder}
            className="w-full border-b border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-100 outline-none placeholder:text-slate-600"
          />
          <ul className="max-h-44 overflow-auto">
            {filtered.length === 0 ? (
              <li className="px-2 py-2 text-xs text-slate-500">No matches</li>
            ) : (
              filtered.map((a) => (
                <li key={a.id}>
                  <button
                    type="button"
                    onClick={() => pick(a)}
                    className={[
                      'flex w-full items-center justify-between px-2 py-1 text-left text-xs hover:bg-slate-800',
                      a.id === value
                        ? 'bg-sky-500/15 text-sky-200'
                        : 'text-slate-200',
                    ].join(' ')}
                  >
                    <span>
                      <span className="font-bold text-amber-200/90">
                        {a.code}
                      </span>
                      <span className="text-slate-500"> {a.city}</span>
                    </span>
                    <span className="text-[10px] text-slate-600">
                      sz {a.size}
                    </span>
                  </button>
                </li>
              ))
            )}
          </ul>
          <button
            type="button"
            className="w-full border-t border-slate-700 py-1 text-[10px] text-slate-500 hover:bg-slate-800"
            onClick={() => setOpen(false)}
          >
            Close
          </button>
        </div>
      )}
    </div>
  )
}
