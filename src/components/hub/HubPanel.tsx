/**
 * Hub network — dense card grid (like Ops).
 */

import { useMemo, useState } from 'react'
import { airports } from '../../data/airports'
import { formatMoney, formatNumber } from '../../lib/format'
import { baseOpenFee } from '../../sim/ceo'
import {
  closeBaseRefund,
  HUB_FACILITIES,
  promoteToHubFee,
  relocateHubFee,
} from '../../sim/hubs'
import { useGameStore } from '../../store/gameStore'
import type { Airport, HubFacilityId } from '../../types'
import { GamePanel } from '../ui/GamePanel'
import { ScreenHeader } from '../ui/ScreenHeader'

export function HubPanel() {
  const hubId = useGameStore((s) => s.hubId)
  const secondaryBases = useGameStore((s) => s.secondaryBases)
  const hubFacilities = useGameStore((s) => s.hubFacilities)
  const routes = useGameStore((s) => s.routes)
  const fleet = useGameStore((s) => s.ownedAircraft)
  const cash = useGameStore((s) => s.cash)
  const gameOver = useGameStore((s) => s.gameOver)

  const setHub = useGameStore((s) => s.setHub)
  const openSecondaryBase = useGameStore((s) => s.openSecondaryBase)
  const closeSecondaryBase = useGameStore((s) => s.closeSecondaryBase)
  const promoteBaseToHub = useGameStore((s) => s.promoteBaseToHub)
  const buildHubFacility = useGameStore((s) => s.buildHubFacility)

  const [msg, setMsg] = useState<string | null>(null)
  const [relocateId, setRelocateId] = useState(hubId ?? 'cgk')
  const [openBaseId, setOpenBaseId] = useState('sub')
  const [query, setQuery] = useState('')

  const hubAp = airports.find((a) => a.id === hubId)

  const networkIds = useMemo(() => {
    const ids = new Set<string>()
    if (hubId) ids.add(hubId)
    for (const id of secondaryBases) ids.add(id)
    for (const r of routes) {
      ids.add(r.fromId)
      ids.add(r.toId)
    }
    return ids
  }, [hubId, secondaryBases, routes])

  const allHubs = useMemo(() => {
    const list: { id: string; role: 'home' | 'base' }[] = []
    if (hubId) list.push({ id: hubId, role: 'home' })
    for (const id of secondaryBases) list.push({ id, role: 'base' })
    return list
  }, [hubId, secondaryBases])

  function statsFor(airportId: string) {
    const routeCount = routes.filter(
      (r) => r.fromId === airportId || r.toId === airportId,
    ).length
    const parked = fleet.filter(
      (a) =>
        a.flight?.status === 'IDLE' && a.flight.legFromId === airportId,
    ).length
    const airborne = fleet.filter(
      (a) =>
        a.flight?.status === 'IN_FLIGHT' &&
        (a.flight.legFromId === airportId || a.flight.legToId === airportId),
    ).length
    return { routeCount, parked, airborne }
  }

  const openCandidates = useMemo(() => {
    const q = query.trim().toLowerCase()
    return airports
      .filter((a) => a.size >= 2)
      .filter((a) => a.id !== hubId && !secondaryBases.includes(a.id))
      .filter(
        (a) =>
          !q ||
          a.code.toLowerCase().includes(q) ||
          a.city.toLowerCase().includes(q) ||
          a.id.includes(q),
      )
      .slice(0, 80)
  }, [hubId, secondaryBases, query])

  const relocateCandidates = useMemo(
    () => airports.filter((a) => a.size >= 3).slice(0, 120),
    [],
  )

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-12">
      <ScreenHeader
        title="🏢 Hub network"
        sub="HQ · bases · facilities · launch points"
        right={
          <div className="text-right text-sm tabular-nums text-[var(--game-muted)]">
            <p>
              {allHubs.length} site{allHubs.length === 1 ? '' : 's'} ·{' '}
              {networkIds.size} airports
            </p>
            <p className="text-[var(--game-cash)]">{formatMoney(cash)}</p>
          </div>
        }
      />

      {msg && (
        <p className="col-span-full rounded-md border border-[rgba(196,163,90,0.3)] bg-[rgba(196,163,90,0.08)] px-3 py-2 text-sm text-[var(--game-brass)]">
          {msg}
        </p>
      )}

      {/* HQ card */}
      <GamePanel title="Home HQ" icon="🏠" className="sm:col-span-1 lg:col-span-5">
        {hubAp ? (
          <SiteCard
            airport={hubAp}
            role="home"
            facilities={hubFacilities[hubAp.id] ?? []}
            stats={statsFor(hubAp.id)}
            cash={cash}
            gameOver={gameOver}
            onBuild={(f) =>
              setMsg(
                buildHubFacility(hubAp.id, f)
                  ? `Built at ${hubAp.code}.`
                  : 'Need cash or already owned.',
              )
            }
          />
        ) : (
          <p className="text-sm text-[var(--game-warn)]">No home hub set.</p>
        )}
      </GamePanel>

      {/* Relocate + open base */}
      <GamePanel title="Relocate HQ" icon="↔" className="sm:col-span-1 lg:col-span-3">
        <p className="mb-2 text-sm text-[var(--game-muted)]">
          Old HQ becomes a secondary base. Cheaper if already your base.
        </p>
        <select
          className="game-input mb-2 text-sm"
          value={relocateId}
          onChange={(e) => setRelocateId(e.target.value)}
        >
          {relocateCandidates.map((a) => {
            const isBase = secondaryBases.includes(a.id)
            const fee = relocateHubFee(isBase, a)
            return (
              <option key={a.id} value={a.id} disabled={a.id === hubId}>
                {a.code} — {a.city} · {formatMoney(fee)}
                {isBase ? ' (base)' : ''}
              </option>
            )
          })}
        </select>
        <button
          type="button"
          disabled={gameOver || relocateId === hubId}
          className="btn-game btn-game-primary w-full"
          onClick={() => {
            const ap = airports.find((a) => a.id === relocateId)
            const fee = ap
              ? relocateHubFee(secondaryBases.includes(relocateId), ap)
              : 0
            setMsg(
              setHub(relocateId)
                ? `HQ → ${ap?.code ?? relocateId}`
                : `Need ${formatMoney(fee)}`,
            )
          }}
        >
          Relocate
        </button>
      </GamePanel>

      <GamePanel title="Open base" icon="＋" className="sm:col-span-2 lg:col-span-4">
        <p className="mb-2 text-sm text-[var(--game-muted)]">
          Unlock a city as launch origin. Fee by airport size.
        </p>
        <input
          type="search"
          placeholder="Search city / code…"
          className="game-input mb-2 text-sm"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select
          className="game-input mb-2 text-sm"
          value={openBaseId}
          onChange={(e) => setOpenBaseId(e.target.value)}
        >
          {openCandidates.map((a) => (
            <option key={a.id} value={a.id}>
              {a.code} — {a.city} · sz{a.size} · {formatMoney(baseOpenFee(a))}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={gameOver || openCandidates.length === 0}
          className="btn-game btn-game-success w-full"
          onClick={() => {
            const ap = airports.find((a) => a.id === openBaseId)
            setMsg(
              openSecondaryBase(openBaseId)
                ? `Base open: ${ap?.code ?? openBaseId}`
                : 'Failed — cash / already open / is HQ',
            )
          }}
        >
          Open base
        </button>
      </GamePanel>

      {/* Secondary bases as cards */}
      <div className="col-span-full">
        <p className="mb-2 font-display text-sm font-semibold uppercase tracking-wide text-[var(--game-brass)]">
          Secondary bases ({secondaryBases.length})
        </p>
        {secondaryBases.length === 0 ? (
          <div className="game-panel px-4 py-6 text-center text-sm text-[var(--game-dim)]">
            No outposts — open a base above to launch from new cities.
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {secondaryBases.map((id) => {
              const ap = airports.find((a) => a.id === id)
              if (!ap) return null
              const st = statsFor(id)
              const refund = closeBaseRefund(ap)
              return (
                <div key={id} className="game-panel">
                  <div className="game-panel-body">
                    <SiteCard
                      airport={ap}
                      role="base"
                      facilities={hubFacilities[id] ?? []}
                      stats={st}
                      cash={cash}
                      gameOver={gameOver}
                      onBuild={(f) =>
                        setMsg(
                          buildHubFacility(id, f)
                            ? `Built at ${ap.code}`
                            : 'Need cash or already owned',
                        )
                      }
                      actions={
                        <div className="flex flex-wrap gap-1">
                          <button
                            type="button"
                            disabled={gameOver || cash < promoteToHubFee()}
                            className="btn-game btn-game-ghost !py-1 !text-xs"
                            onClick={() =>
                              setMsg(
                                promoteBaseToHub(id)
                                  ? `${ap.code} → HQ`
                                  : `Need ${formatMoney(promoteToHubFee())}`,
                              )
                            }
                          >
                            Make HQ
                          </button>
                          <button
                            type="button"
                            disabled={gameOver}
                            className="btn-game btn-game-danger !py-1 !text-xs"
                            onClick={() => {
                              if (
                                !window.confirm(
                                  `Close ${ap.code}? Refund ~${formatMoney(refund)}`,
                                )
                              )
                                return
                              setMsg(
                                closeSecondaryBase(id)
                                  ? `Closed ${ap.code}`
                                  : 'Could not close',
                              )
                            }}
                          >
                            Close +{formatMoney(refund)}
                          </button>
                        </div>
                      }
                    />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Network snapshot cards */}
      <GamePanel
        title="Network snapshot"
        icon="🗺"
        className="sm:col-span-2 lg:col-span-8"
      >
        <div className="grid gap-2 sm:grid-cols-2">
          {allHubs.map(({ id, role }) => {
            const ap = airports.find((a) => a.id === id)
            const st = statsFor(id)
            const fac = hubFacilities[id] ?? []
            return (
              <div
                key={id}
                className="rounded-md border border-[rgba(160,145,120,0.18)] bg-black/20 px-3 py-2.5"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <p className="font-semibold">
                    {ap?.code ?? id}{' '}
                    <span className="font-normal text-[var(--game-muted)]">
                      {ap?.city}
                    </span>
                  </p>
                  <span
                    className={
                      role === 'home'
                        ? 'text-xs font-semibold text-[var(--game-brass)]'
                        : 'text-xs font-semibold text-[var(--game-olive)]'
                    }
                  >
                    {role === 'home' ? 'HQ' : 'Base'}
                  </span>
                </div>
                <p className="mt-1 text-sm text-[var(--game-muted)]">
                  {st.routeCount} routes · {st.parked} parked · {st.airborne}{' '}
                  active
                </p>
                <p className="mt-0.5 text-xs text-[var(--game-dim)]">
                  {fac.length
                    ? fac
                        .map(
                          (f) =>
                            HUB_FACILITIES.find((d) => d.id === f)?.label ?? f,
                        )
                        .join(' · ')
                    : 'No facilities'}
                </p>
              </div>
            )
          })}
        </div>
        <p className="mt-2 text-xs text-[var(--game-dim)]">
          Origins: HQ, secondary base, or network airport (
          {formatNumber(networkIds.size)} reachable)
        </p>
      </GamePanel>

      {/* Facility catalog */}
      <GamePanel
        title="Facility catalog"
        icon="🔧"
        className="sm:col-span-2 lg:col-span-4"
      >
        <ul className="space-y-2">
          {HUB_FACILITIES.map((f) => (
            <li
              key={f.id}
              className="rounded-md border border-[rgba(160,145,120,0.15)] bg-black/15 px-2.5 py-2"
            >
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-sm font-semibold">{f.label}</p>
                <p className="text-sm tabular-nums text-[var(--game-brass)]">
                  {formatMoney(f.cost)}
                </p>
              </div>
              <p className="text-xs text-[var(--game-muted)]">{f.effect}</p>
            </li>
          ))}
        </ul>
      </GamePanel>
    </div>
  )
}

function SiteCard({
  airport,
  role,
  facilities,
  stats,
  cash,
  gameOver,
  onBuild,
  actions,
}: {
  airport: Airport
  role: 'home' | 'base'
  facilities: HubFacilityId[]
  stats: { routeCount: number; parked: number; airborne: number }
  cash: number
  gameOver: boolean
  onBuild: (f: HubFacilityId) => void
  actions?: React.ReactNode
}) {
  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-base font-semibold">
            {airport.code}{' '}
            <span className="font-normal text-[var(--game-muted)]">
              {airport.city}
            </span>
          </p>
          <p className="text-sm text-[var(--game-dim)]">
            {role === 'home' ? 'Home hub' : 'Secondary'} · sz {airport.size}/5 ·{' '}
            {stats.routeCount} rte · {stats.parked} park · {stats.airborne} live
          </p>
        </div>
        {actions}
      </div>
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {HUB_FACILITIES.map((f) => {
          const owned = facilities.includes(f.id)
          return (
            <button
              key={f.id}
              type="button"
              disabled={gameOver || owned || cash < f.cost}
              title={f.effect}
              onClick={() => onBuild(f.id)}
              className={[
                'rounded-md px-2 py-1.5 text-xs font-semibold transition',
                owned
                  ? 'bg-[rgba(143,173,122,0.15)] text-[var(--game-cash)] ring-1 ring-[rgba(143,173,122,0.35)]'
                  : 'border border-[rgba(160,145,120,0.25)] text-[var(--game-muted)] hover:border-[var(--game-brass)] hover:text-[var(--game-brass)] disabled:opacity-40',
              ].join(' ')}
            >
              {owned ? `✓ ${f.label}` : `${f.label} · ${formatMoney(f.cost)}`}
            </button>
          )
        })}
      </div>
    </div>
  )
}
