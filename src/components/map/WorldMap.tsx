/**
 * Polished world map — precomputed country paths, live aircraft, controls.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type TouchEvent as ReactTouchEvent,
  type WheelEvent as ReactWheelEvent,
} from 'react'
import {
  MAP_HEIGHT,
  MAP_WIDTH,
  countryPathDs,
  projectLngLat,
} from '../../data/worldMapData'
import { airports } from '../../data/airports'
import { interpolateGreatCircle } from '../../lib/geo'
import { formatDurationHm, formatLocalTime } from '../../lib/time'
import { mapCargoLanes } from '../../sim/mapCargo'
import { getLiveAircraft, type LiveAircraft } from '../../store/selectors'
import { useGameStore } from '../../store/gameStore'

const ARC_SAMPLES = 48
const DEFAULT_ZOOM = 1
const MIN_ZOOM = 0.5
/** High enough to separate dense Indonesia regional airports. */
const MAX_ZOOM = 28

/** Rough Indonesia bounding box (for Fit Indonesia). */
const ID_BOUNDS = { latMin: -11.2, latMax: 6.2, lngMin: 94.8, lngMax: 141.2 }

function clampZoom(z: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z))
}

/**
 * Constant on-screen size: parent group is scaled by `zoom`, so map-space
 * sizes must be divided by zoom (not sqrt) or labels explode when zooming in.
 */
function screenToMap(px: number, zoom: number): number {
  return px / zoom
}

type LabeledAirport = {
  id: string
  code: string
  size: number
  x: number
  y: number
  onNetwork: boolean
  priority: number
}

/**
 * Greedy declutter: higher priority first, skip if too close (screen px) to
 * an already accepted label. Prevents Indonesia text pile-ups.
 */
function pickLabels(
  candidates: LabeledAirport[],
  zoom: number,
  minScreenPx: number,
): Set<string> {
  const minDist = minScreenPx / zoom
  const minDist2 = minDist * minDist
  const sorted = [...candidates].sort((a, b) => b.priority - a.priority)
  const accepted: LabeledAirport[] = []
  const ids = new Set<string>()

  for (const c of sorted) {
    let ok = true
    for (const a of accepted) {
      const dx = c.x - a.x
      const dy = c.y - a.y
      if (dx * dx + dy * dy < minDist2) {
        ok = false
        break
      }
    }
    if (ok) {
      accepted.push(c)
      ids.add(c.id)
    }
  }
  return ids
}

type ArcInfo = {
  id: string
  d: string
  fromId: string
  toId: string
  selected: boolean
  active: boolean
}

export type MapFilterMode = 'all' | 'network' | 'flying' | 'hubs' | 'cargo'

type WorldMapProps = {
  filterMode?: MapFilterMode
}

function greatCirclePath(
  fromCoords: { lat: number; lng: number },
  toCoords: { lat: number; lng: number },
): string | null {
  const parts: string[] = []
  for (let i = 0; i <= ARC_SAMPLES; i++) {
    const p = interpolateGreatCircle(fromCoords, toCoords, i / ARC_SAMPLES)
    const xy = projectLngLat(p.lng, p.lat)
    if (!xy) continue
    parts.push(
      `${parts.length === 0 ? 'M' : 'L'}${xy[0].toFixed(1)},${xy[1].toFixed(1)}`,
    )
  }
  return parts.length ? parts.join(' ') : null
}

export function WorldMap({ filterMode = 'all' }: WorldMapProps) {
  const routes = useGameStore((s) => s.routes)
  const ownedAircraft = useGameStore((s) => s.ownedAircraft)
  const hubId = useGameStore((s) => s.hubId)
  const secondaryBases = useGameStore((s) => s.secondaryBases)
  const contracts = useGameStore((s) => s.contracts)
  const mapCargoOffers = useGameStore((s) => s.mapCargoOffers)

  // Recompute live positions whenever fleet updates (refreshFlights @ 1Hz)
  const live = useMemo(
    () => getLiveAircraft(useGameStore.getState()),
    [ownedAircraft],
  )

  const cargoLanes = useMemo(
    () => mapCargoLanes(mapCargoOffers, contracts),
    [mapCargoOffers, contracts],
  )

  const cargoAirportIds = useMemo(() => {
    const ids = new Set<string>()
    for (const l of cargoLanes) {
      ids.add(l.fromId)
      ids.add(l.toId)
    }
    return ids
  }, [cargoLanes])

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [hoveredAirportId, setHoveredAirportId] = useState<string | null>(null)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(DEFAULT_ZOOM)
  const [mapH, setMapH] = useState(560)
  const drag = useRef<{
    on: boolean
    moved: boolean
    x: number
    y: number
  }>({ on: false, moved: false, x: 0, y: 0 })
  const pinch = useRef<{ dist: number; zoom: number } | null>(null)

  // Responsive map height (shorter on phones)
  useEffect(() => {
    function measure() {
      const w = window.innerWidth
      if (w < 480) setMapH(Math.round(Math.min(380, window.innerHeight * 0.42)))
      else if (w < 640) setMapH(Math.round(Math.min(440, window.innerHeight * 0.48)))
      else setMapH(560)
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])

  const nowMs = Date.now()
  /** Hide aircraft markers in hubs-only filter. */
  const displayLive = filterMode === 'hubs' ? [] : live
  const selected =
    live.find((a) => a.instanceId === selectedId) ?? null
  const selectedRoute = routes.find((r) => r.aircraftInstanceId === selectedId)

  /** Airport ids that appear on at least one active route. */
  const activeAirportIds = useMemo(() => {
    const ids = new Set<string>()
    for (const r of routes) {
      ids.add(r.fromId)
      ids.add(r.toId)
    }
    for (const ac of live) {
      ids.add(ac.legFromId)
      ids.add(ac.legToId)
    }
    return ids
  }, [routes, live])

  const hubIds = useMemo(() => {
    const s = new Set<string>()
    if (hubId) s.add(hubId)
    for (const id of secondaryBases) s.add(id)
    return s
  }, [hubId, secondaryBases])

  const arcs: ArcInfo[] = useMemo(() => {
    if (filterMode === 'hubs' || filterMode === 'cargo') return []
    const routeList =
      filterMode === 'flying'
        ? routes.filter((r) =>
            live.some((a) => a.instanceId === r.aircraftInstanceId),
          )
        : routes
    return routeList.flatMap((route) => {
      const from = airports.find((a) => a.id === route.fromId)
      const to = airports.find((a) => a.id === route.toId)
      if (!from || !to) return []

      const d = greatCirclePath(from.coords, to.coords)
      if (!d) return []

      const selected =
        selectedId != null && route.aircraftInstanceId === selectedId
      const active = live.some(
        (a) => a.instanceId === route.aircraftInstanceId,
      )

      return [
        {
          id: route.id,
          d,
          fromId: route.fromId,
          toId: route.toId,
          selected,
          active,
        },
      ]
    })
  }, [routes, selectedId, live, filterMode])

  type CargoArc = {
    id: string
    d: string
    active: boolean
    fromId: string
    toId: string
  }

  const cargoArcs: CargoArc[] = useMemo(() => {
    // flying/hubs: hide cargo arcs; cargo filter shows offers+jobs; else active only
    if (filterMode === 'flying' || filterMode === 'hubs') return []
    const list =
      filterMode === 'cargo'
        ? cargoLanes
        : cargoLanes.filter((l) => l.active)

    return list.flatMap((lane) => {
      const from = airports.find((a) => a.id === lane.fromId)
      const to = airports.find((a) => a.id === lane.toId)
      if (!from || !to) return []
      const d = greatCirclePath(from.coords, to.coords)
      if (!d) return []
      return [
        {
          id: `cargo-${lane.id}`,
          d,
          active: lane.active,
          fromId: lane.fromId,
          toId: lane.toId,
        },
      ]
    })
  }, [cargoLanes, filterMode])

  const resetView = useCallback(() => {
    setPan({ x: 0, y: 0 })
    setZoom(DEFAULT_ZOOM)
  }, [])

  /** Fit view to a set of projected points. */
  const fitToPoints = useCallback(
    (pts: [number, number][], pad = 40) => {
      if (pts.length === 0) {
        resetView()
        return
      }

      let minX = Infinity
      let minY = Infinity
      let maxX = -Infinity
      let maxY = -Infinity
      for (const [x, y] of pts) {
        minX = Math.min(minX, x)
        minY = Math.min(minY, y)
        maxX = Math.max(maxX, x)
        maxY = Math.max(maxY, y)
      }

      const bw = Math.max(maxX - minX, 24) + pad * 2
      const bh = Math.max(maxY - minY, 24) + pad * 2
      const cx = (minX + maxX) / 2
      const cy = (minY + maxY) / 2
      const k = clampZoom(
        Math.min(MAP_WIDTH / bw, MAP_HEIGHT / bh) * 0.9,
      )

      // transform: (p - C) * k + C + pan → center centroid at C
      setZoom(k)
      setPan({
        x: (MAP_WIDTH / 2 - cx) * k,
        y: (MAP_HEIGHT / 2 - cy) * k,
      })
    },
    [resetView],
  )

  /** Zoom to active network (or world hubs if none). */
  const fitNetwork = useCallback(() => {
    const pts = airports
      .filter((a) => activeAirportIds.size === 0 || activeAirportIds.has(a.id))
      .map((a) => projectLngLat(a.coords.lng, a.coords.lat))
      .filter((p): p is [number, number] => p != null)
    fitToPoints(pts, activeAirportIds.size > 0 ? 36 : 20)
  }, [activeAirportIds, fitToPoints])

  /** Zoom into the Indonesian archipelago (dense regional airports). */
  const fitIndonesia = useCallback(() => {
    const pts = airports
      .filter(
        (a) =>
          a.coords.lat >= ID_BOUNDS.latMin &&
          a.coords.lat <= ID_BOUNDS.latMax &&
          a.coords.lng >= ID_BOUNDS.lngMin &&
          a.coords.lng <= ID_BOUNDS.lngMax,
      )
      .map((a) => projectLngLat(a.coords.lng, a.coords.lat))
      .filter((p): p is [number, number] => p != null)
    fitToPoints(pts, 28)
  }, [fitToPoints])

  function zoomBy(factor: number) {
    setZoom((z) => clampZoom(z * factor))
  }

  /** Wheel zoom toward cursor so dense clusters are easier to inspect. */
  function onWheel(e: ReactWheelEvent<SVGSVGElement>) {
    e.preventDefault()
    const factor = e.deltaY > 0 ? 0.85 : 1.18
    const rect = e.currentTarget.getBoundingClientRect()
    const mx = ((e.clientX - rect.left) / rect.width) * MAP_WIDTH
    const my = ((e.clientY - rect.top) / rect.height) * MAP_HEIGHT
    const C = { x: MAP_WIDTH / 2, y: MAP_HEIGHT / 2 }

    setZoom((z) => {
      const nz = clampZoom(z * factor)
      // pan' = pan + (m - C - pan) * (1 - nz/z)
      setPan((pan0) => {
        const t = 1 - nz / z
        return {
          x: pan0.x + (mx - C.x - pan0.x) * t,
          y: pan0.y + (my - C.y - pan0.y) * t,
        }
      })
      return nz
    })
  }

  function onDoubleClick(e: ReactMouseEvent<SVGSVGElement>) {
    e.preventDefault()
    const rect = e.currentTarget.getBoundingClientRect()
    const mx = ((e.clientX - rect.left) / rect.width) * MAP_WIDTH
    const my = ((e.clientY - rect.top) / rect.height) * MAP_HEIGHT
    const C = { x: MAP_WIDTH / 2, y: MAP_HEIGHT / 2 }
    setZoom((z) => {
      const nz = clampZoom(z * 1.8)
      setPan((pan0) => {
        const t = 1 - nz / z
        return {
          x: pan0.x + (mx - C.x - pan0.x) * t,
          y: pan0.y + (my - C.y - pan0.y) * t,
        }
      })
      return nz
    })
  }

  function onMouseDown(e: ReactMouseEvent<SVGSVGElement>) {
    drag.current = { on: true, moved: false, x: e.clientX, y: e.clientY }
  }

  function onMouseMove(e: ReactMouseEvent<SVGSVGElement>) {
    if (!drag.current.on) return
    const dx = e.clientX - drag.current.x
    const dy = e.clientY - drag.current.y
    if (Math.abs(dx) + Math.abs(dy) > 2) drag.current.moved = true
    drag.current.x = e.clientX
    drag.current.y = e.clientY
    setPan((p) => ({ x: p.x + dx, y: p.y + dy }))
  }

  function onMouseUp() {
    drag.current.on = false
  }

  function onTouchStart(e: ReactTouchEvent<SVGSVGElement>) {
    if (e.touches.length === 2) {
      const [a, b] = [e.touches[0], e.touches[1]]
      const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
      pinch.current = { dist, zoom }
      drag.current.on = false
      return
    }
    if (e.touches.length === 1) {
      const t = e.touches[0]
      drag.current = { on: true, moved: false, x: t.clientX, y: t.clientY }
      pinch.current = null
    }
  }

  function onTouchMove(e: ReactTouchEvent<SVGSVGElement>) {
    if (e.touches.length === 2 && pinch.current) {
      e.preventDefault()
      const [a, b] = [e.touches[0], e.touches[1]]
      const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
      const factor = dist / Math.max(1, pinch.current.dist)
      setZoom(clampZoom(pinch.current.zoom * factor))
      return
    }
    if (!drag.current.on || e.touches.length !== 1) return
    e.preventDefault()
    const t = e.touches[0]
    const dx = t.clientX - drag.current.x
    const dy = t.clientY - drag.current.y
    if (Math.abs(dx) + Math.abs(dy) > 2) drag.current.moved = true
    drag.current.x = t.clientX
    drag.current.y = t.clientY
    setPan((p) => ({ x: p.x + dx, y: p.y + dy }))
  }

  function onTouchEnd() {
    drag.current.on = false
    pinch.current = null
  }

  function onMapBackgroundClick() {
    if (!drag.current.moved) setSelectedId(null)
  }

  /** Fit view to cargo OD airports when filtering cargo. */
  const fitCargo = useCallback(() => {
    const pts = airports
      .filter((a) => cargoAirportIds.has(a.id))
      .map((a) => projectLngLat(a.coords.lng, a.coords.lat))
      .filter((p): p is [number, number] => p != null)
    fitToPoints(pts, 48)
  }, [cargoAirportIds, fitToPoints])

  const hoveredAirport = airports.find((a) => a.id === hoveredAirportId)

  /** Projected airports + which codes survive declutter at current zoom. */
  const { airportMarkers, labelIds } = useMemo(() => {
    const markers: Array<{
      id: string
      code: string
      size: 1 | 2 | 3 | 4 | 5
      x: number
      y: number
      onNetwork: boolean
    }> = []

    for (const ap of airports) {
      const xy = projectLngLat(ap.coords.lng, ap.coords.lat)
      if (!xy) continue
      const onNetwork = activeAirportIds.has(ap.id)
      const isHub = hubIds.has(ap.id)

      const onCargo = cargoAirportIds.has(ap.id)
      if (filterMode === 'network' && !onNetwork) continue
      if (filterMode === 'hubs' && !isHub) continue
      if (filterMode === 'flying' && !onNetwork) continue
      if (filterMode === 'cargo' && !onCargo) continue

      // Hide tiny regional dots until zoomed — cuts visual noise massively.
      if (filterMode === 'all') {
        if (ap.size <= 1 && zoom < 4 && !onNetwork && !onCargo) continue
        if (ap.size === 2 && zoom < 2 && !onNetwork && !onCargo) continue
      }

      markers.push({
        id: ap.id,
        code: ap.code,
        size: ap.size,
        x: xy[0],
        y: xy[1],
        onNetwork: onNetwork || isHub || onCargo,
      })
    }

    const candidates: LabeledAirport[] = []
    for (const m of markers) {
      // Eligibility by zoom (before collision filter)
      let eligible = false
      if (filterMode === 'cargo') eligible = true
      else if (filterMode !== 'all') eligible = true
      else if (m.onNetwork && zoom >= 1.2) eligible = true
      else if (m.size >= 5 && zoom >= 1.0) eligible = true
      else if (m.size >= 4 && zoom >= 2.2) eligible = true
      else if (m.size >= 3 && zoom >= 4.5) eligible = true
      else if (m.size >= 2 && zoom >= 8) eligible = true
      else if (m.size >= 1 && zoom >= 12) eligible = true

      if (!eligible) continue

      const cargoBoost = cargoAirportIds.has(m.id) ? 800 : 0
      const priority =
        (m.onNetwork ? 1000 : 0) +
        cargoBoost +
        m.size * 100 -
        Math.hypot(m.x, m.y) * 0.001

      candidates.push({
        id: m.id,
        code: m.code,
        size: m.size,
        x: m.x,
        y: m.y,
        onNetwork: m.onNetwork,
        priority,
      })
    }

    // Tighter spacing at high zoom still keeps codes readable (~42px gaps)
    const labelIds = pickLabels(candidates, zoom, 42)

    return { airportMarkers: markers, labelIds }
  }, [activeAirportIds, zoom, filterMode, hubIds, cargoAirportIds])

  return (
    <div className="relative w-full overflow-hidden rounded-2xl border border-slate-700/80 bg-slate-950 shadow-lg shadow-black/30">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 bg-gradient-to-r from-slate-900 via-slate-900 to-slate-900/90 px-3 py-2">
        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
          <StatChip
            label="Airborne"
            value={String(live.length)}
            accent="text-sky-300"
          />
          <StatChip
            label="Routes"
            value={String(routes.length)}
            accent="text-emerald-300"
          />
          <StatChip
            label="Local"
            value={formatLocalTime()}
            accent="text-slate-300"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1">
          <ToolbarBtn label="−" title="Zoom out" onClick={() => zoomBy(0.8)} />
          <span className="min-w-[2.75rem] text-center font-mono text-[11px] tabular-nums text-slate-500">
            {Math.round(zoom * 100)}%
          </span>
          <ToolbarBtn label="+" title="Zoom in" onClick={() => zoomBy(1.25)} />
          <ToolbarBtn
            label="ID"
            title="Zoom ke kepulauan Indonesia"
            onClick={fitIndonesia}
          />
          <ToolbarBtn
            label="Net"
            title="Fit to your active routes"
            onClick={fitNetwork}
          />
          {cargoAirportIds.size > 0 && (
            <ToolbarBtn
              label="Cargo"
              title="Fit to cargo job airports"
              onClick={fitCargo}
            />
          )}
          <ToolbarBtn label="Reset" title="Reset pan & zoom" onClick={resetView} />
        </div>
      </div>

      <div
        className="relative w-full touch-none"
        style={{ height: mapH, background: '#070d18' }}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
          width="100%"
          height={mapH}
          className="block select-none"
          style={{
            display: 'block',
            background: 'radial-gradient(ellipse at center, #0f172a 0%, #070d18 70%)',
            cursor: drag.current.on ? 'grabbing' : 'grab',
            touchAction: 'none',
          }}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          onTouchCancel={onTouchEnd}
          onWheel={onWheel}
          onDoubleClick={onDoubleClick}
          onClick={onMapBackgroundClick}
        >
          <defs>
            <filter id="plane-glow" x="-80%" y="-80%" width="260%" height="260%">
              <feGaussianBlur stdDeviation="1.6" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <linearGradient id="arc-active" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.35" />
              <stop offset="50%" stopColor="#7dd3fc" stopOpacity="0.95" />
              <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.35" />
            </linearGradient>
            <linearGradient id="arc-cargo" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#fb923c" stopOpacity="0.4" />
              <stop offset="50%" stopColor="#fdba74" stopOpacity="0.95" />
              <stop offset="100%" stopColor="#fb923c" stopOpacity="0.4" />
            </linearGradient>
          </defs>

          {/* Soft vignette ocean */}
          <rect x={0} y={0} width={MAP_WIDTH} height={MAP_HEIGHT} fill="#070d18" />

          <g
            transform={`translate(${MAP_WIDTH / 2 + pan.x} ${MAP_HEIGHT / 2 + pan.y}) scale(${zoom}) translate(${-MAP_WIDTH / 2} ${-MAP_HEIGHT / 2})`}
          >
            {/* Land */}
            {countryPathDs.map((d, i) => (
              <path
                key={i}
                d={d}
                fill="#1a2438"
                stroke="#2d3a52"
                strokeWidth={0.5 / zoom}
                style={{ pointerEvents: 'none' }}
              />
            ))}

            {/* Route arcs — inactive first, active/selected on top */}
            {arcs
              .slice()
              .sort((a, b) => Number(a.selected) - Number(b.selected) || Number(a.active) - Number(b.active))
              .map((a) => (
                <g key={a.id} style={{ pointerEvents: 'none' }}>
                  {/* soft under-glow */}
                  <path
                    d={a.d}
                    fill="none"
                    stroke={a.selected ? '#38bdf8' : a.active ? '#0ea5e9' : '#334155'}
                    strokeWidth={(a.selected ? 5 : a.active ? 3.5 : 2) / zoom}
                    strokeOpacity={a.selected ? 0.25 : 0.15}
                    strokeLinecap="round"
                  />
                  <path
                    d={a.d}
                    fill="none"
                    stroke={
                      a.selected
                        ? 'url(#arc-active)'
                        : a.active
                          ? '#38bdf8'
                          : '#64748b'
                    }
                    strokeWidth={(a.selected ? 2.2 : a.active ? 1.6 : 1.1) / zoom}
                    strokeOpacity={a.selected ? 1 : a.active ? 0.75 : 0.4}
                    strokeLinecap="round"
                    strokeDasharray={a.active || a.selected ? undefined : `${4 / zoom} ${3 / zoom}`}
                  />
                </g>
              ))}

            {/* Map cargo lanes — orange; solid = accepted, dashed = open offer */}
            {cargoArcs.map((a) => (
              <g key={a.id} style={{ pointerEvents: 'none' }}>
                <path
                  d={a.d}
                  fill="none"
                  stroke="#ea580c"
                  strokeWidth={(a.active ? 4.5 : 3) / zoom}
                  strokeOpacity={0.2}
                  strokeLinecap="round"
                />
                <path
                  d={a.d}
                  fill="none"
                  stroke={a.active ? 'url(#arc-cargo)' : '#fb923c'}
                  strokeWidth={(a.active ? 2.1 : 1.4) / zoom}
                  strokeOpacity={a.active ? 0.95 : 0.65}
                  strokeLinecap="round"
                  strokeDasharray={
                    a.active ? undefined : `${5 / zoom} ${4 / zoom}`
                  }
                />
              </g>
            ))}

            {/* Airports: constant screen-size dots + decluttered labels */}
            {airportMarkers.map((m) => {
              const hovered = hoveredAirportId === m.id
              const showLabel = hovered || labelIds.has(m.id)
              const isCargo = cargoAirportIds.has(m.id)

              // Map-space radius so on-screen size stays ~constant
              const screenR =
                m.onNetwork || hovered || isCargo
                  ? 5
                  : m.size >= 4
                    ? 4
                    : m.size >= 3
                      ? 3.2
                      : 2.4
              const r = screenToMap(screenR, zoom)
              const fontPx = screenToMap(11, zoom)
              const strokeW = screenToMap(1, zoom)

              return (
                <g
                  key={m.id}
                  transform={`translate(${m.x} ${m.y})`}
                  style={{ cursor: 'pointer' }}
                  onMouseEnter={(e) => {
                    e.stopPropagation()
                    setHoveredAirportId(m.id)
                  }}
                  onMouseLeave={() => setHoveredAirportId(null)}
                  onClick={(e) => e.stopPropagation()}
                >
                  {isCargo && (
                    <circle
                      r={r + screenToMap(5, zoom)}
                      fill="none"
                      stroke="#fb923c"
                      strokeWidth={strokeW * 1.2}
                      opacity={0.75}
                    />
                  )}
                  {m.onNetwork && !isCargo && (
                    <circle
                      r={r + screenToMap(3, zoom)}
                      fill="none"
                      stroke="#38bdf8"
                      strokeWidth={strokeW}
                      opacity={0.4}
                    />
                  )}
                  <circle
                    r={r}
                    fill={
                      hovered
                        ? '#fde68a'
                        : isCargo
                          ? '#fb923c'
                          : m.onNetwork
                            ? '#fbbf24'
                            : m.size <= 2
                              ? '#64748b'
                              : '#94a3b8'
                    }
                    stroke="#0f172a"
                    strokeWidth={strokeW}
                  />
                  {showLabel && (
                    <g style={{ pointerEvents: 'none' }}>
                      {/* Dark halo so text stays readable on light land strokes */}
                      <text
                        y={-r - screenToMap(5, zoom)}
                        textAnchor="middle"
                        fill="#020617"
                        fontSize={fontPx}
                        fontWeight={800}
                        fontFamily="system-ui, sans-serif"
                        stroke="#020617"
                        strokeWidth={screenToMap(3, zoom)}
                        paintOrder="stroke"
                      >
                        {m.code}
                      </text>
                      <text
                        y={-r - screenToMap(5, zoom)}
                        textAnchor="middle"
                        fill={hovered || m.onNetwork ? '#f8fafc' : '#e2e8f0'}
                        fontSize={fontPx}
                        fontWeight={700}
                        fontFamily="system-ui, sans-serif"
                      >
                        {m.code}
                      </text>
                    </g>
                  )}
                </g>
              )
            })}

            {/* Aircraft — small top-down plane icon (not a pointer/arrow) */}
            {displayLive.map((ac) => {
              const xy = projectLngLat(ac.lng, ac.lat)
              if (!xy) return null
              const sel = ac.instanceId === selectedId
              // Keep ~constant screen size (parent group is scaled by zoom)
              const s = 1 / zoom

              return (
                <g
                  key={ac.instanceId}
                  transform={`translate(${xy[0]} ${xy[1]}) rotate(${ac.heading}) scale(${s})`}
                  filter={sel ? 'url(#plane-glow)' : undefined}
                  style={{ cursor: 'pointer' }}
                  onClick={(e) => {
                    e.stopPropagation()
                    setSelectedId((id) =>
                      id === ac.instanceId ? null : ac.instanceId,
                    )
                  }}
                >
                  {/* Soft progress arc under the plane */}
                  <circle
                    r={16}
                    fill="none"
                    stroke="#0f172a"
                    strokeWidth={2.5}
                    opacity={0.75}
                  />
                  <circle
                    r={16}
                    fill="none"
                    stroke={sel ? '#38bdf8' : '#64748b'}
                    strokeWidth={2.5}
                    strokeDasharray={`${ac.progress * 100.5} 100.5`}
                    strokeLinecap="round"
                    transform="rotate(-90)"
                    opacity={0.85}
                  />

                  {/* Top-down airliner silhouette; nose = up (heading 0° = north) */}
                  <g transform="scale(1.15)">
                    {/* wings */}
                    <path
                      d="M-11,1 L-2.2,-1.2 L-2.2,1.8 L-11,4.2 Z"
                      fill={sel ? '#7dd3fc' : '#e2e8f0'}
                      stroke="#0f172a"
                      strokeWidth={0.55}
                      strokeLinejoin="round"
                    />
                    <path
                      d="M11,1 L2.2,-1.2 L2.2,1.8 L11,4.2 Z"
                      fill={sel ? '#7dd3fc' : '#e2e8f0'}
                      stroke="#0f172a"
                      strokeWidth={0.55}
                      strokeLinejoin="round"
                    />
                    {/* fuselage + nose */}
                    <path
                      d="M0,-11 C1.6,-11 2.3,-8 2.3,-4 L2.3,7 C2.3,8.2 1.4,9 0,9 C-1.4,9 -2.3,8.2 -2.3,7 L-2.3,-4 C-2.3,-8 -1.6,-11 0,-11 Z"
                      fill={sel ? '#bae6fd' : '#f8fafc'}
                      stroke="#0f172a"
                      strokeWidth={0.6}
                    />
                    {/* tail fin */}
                    <path
                      d="M0,6.5 L0,10.5 L-4.5,12.2 L-4.2,10.4 Z"
                      fill={sel ? '#38bdf8' : '#cbd5e1'}
                      stroke="#0f172a"
                      strokeWidth={0.45}
                      strokeLinejoin="round"
                    />
                    <path
                      d="M0,6.5 L0,10.5 L4.5,12.2 L4.2,10.4 Z"
                      fill={sel ? '#38bdf8' : '#cbd5e1'}
                      stroke="#0f172a"
                      strokeWidth={0.45}
                      strokeLinejoin="round"
                    />
                    {/* cabin windows hint */}
                    <circle cx={0} cy={-5.5} r={0.7} fill="#0ea5e9" opacity={0.85} />
                    <circle cx={0} cy={-3.2} r={0.55} fill="#0ea5e9" opacity={0.7} />
                    <circle cx={0} cy={-1} r={0.55} fill="#0ea5e9" opacity={0.7} />
                  </g>
                </g>
              )
            })}
          </g>
        </svg>

        {/* Legend — compact on mobile */}
        <div className="pointer-events-none absolute bottom-2 left-2 max-w-[12rem] rounded-xl border border-slate-700/80 bg-slate-950/85 px-2.5 py-1.5 text-[10px] text-slate-400 backdrop-blur-sm sm:bottom-3 sm:left-3 sm:max-w-[14rem] sm:px-3 sm:py-2 sm:text-[11px]">
          <div className="mb-1 text-[9px] font-semibold uppercase tracking-wider text-slate-500 sm:mb-1.5 sm:text-[10px]">
            Legend
          </div>
          <ul className="space-y-0.5 sm:space-y-1">
            <LegendRow color="#fbbf24" label="Your network" />
            <LegendRow color="#fb923c" label="Cargo pickup/drop" />
            <LegendRow color="#38bdf8" label="Active flight" />
            <LegendRow color="#fb923c" label="Cargo lane" dashed />
          </ul>
        </div>

        {/* Empty routes hint */}
        {routes.length === 0 && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="rounded-2xl border border-dashed border-slate-600/80 bg-slate-950/70 px-5 py-4 text-center text-sm text-slate-400 backdrop-blur-sm">
              <p className="font-medium text-slate-300">No routes yet</p>
              <p className="mt-1 text-xs text-slate-500">
                Open a route in the Routes tab — arcs and planes will appear here.
              </p>
            </div>
          </div>
        )}

        {/* Airport hover card */}
        {hoveredAirport && (
          <div className="pointer-events-none absolute left-2 top-2 max-w-[11rem] rounded-lg border border-slate-600 bg-slate-900/95 px-2.5 py-1.5 text-[11px] shadow-lg sm:left-3 sm:top-3 sm:max-w-none sm:px-3 sm:py-2 sm:text-xs">
            <p className="font-bold text-amber-300">{hoveredAirport.code}</p>
            <p className="text-slate-200">{hoveredAirport.city}</p>
            <p className="mt-0.5 text-slate-500">
              Size {hoveredAirport.size}/5
              {activeAirportIds.has(hoveredAirport.id) ? ' · network' : ''}
              {cargoAirportIds.has(hoveredAirport.id) ? ' · cargo job' : ''}
            </p>
          </div>
        )}
      </div>

      {selected && (
        <AircraftPopover
          aircraft={selected}
          nowMs={nowMs}
          routeLabel={
            selectedRoute
              ? `${codeOf(selectedRoute.fromId)} ↔ ${codeOf(selectedRoute.toId)}`
              : `${codeOf(selected.legFromId)} → ${codeOf(selected.legToId)}`
          }
          legLabel={`${codeOf(selected.legFromId)} → ${codeOf(selected.legToId)}`}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  )
}

function codeOf(id: string): string {
  return airports.find((a) => a.id === id)?.code ?? '?'
}

function StatChip({
  label,
  value,
  accent,
}: {
  label: string
  value: string
  accent: string
}) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-600">
        {label}
      </span>
      <span className={`font-mono text-xs font-semibold tabular-nums ${accent}`}>
        {value}
      </span>
    </div>
  )
}

function ToolbarBtn({
  label,
  title,
  onClick,
}: {
  label: string
  title: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className="rounded-lg border border-slate-700 bg-slate-800/80 px-2.5 py-1 text-xs font-semibold text-slate-200 transition hover:border-sky-500/40 hover:bg-slate-700 hover:text-white"
    >
      {label}
    </button>
  )
}

function LegendRow({
  color,
  label,
  dashed,
}: {
  color: string
  label: string
  dashed?: boolean
}) {
  return (
    <li className="flex items-center gap-2">
      <span
        className="inline-block h-0.5 w-4 rounded-full"
        style={{
          background: dashed ? 'transparent' : color,
          borderTop: dashed ? `2px dashed ${color}` : undefined,
        }}
      />
      <span>{label}</span>
    </li>
  )
}

function AircraftPopover({
  aircraft,
  nowMs,
  routeLabel,
  legLabel,
  onClose,
}: {
  aircraft: LiveAircraft
  nowMs: number
  routeLabel: string
  legLabel: string
  onClose: () => void
}) {
  const eta = formatDurationHm(aircraft.arriveAt - nowMs)
  const progressPct = Math.round(aircraft.progress * 100)

  return (
    <div className="absolute right-3 top-14 z-10 w-72 animate-scale-in rounded-xl border border-slate-600/90 bg-slate-900/95 p-3.5 shadow-2xl shadow-black/50 backdrop-blur">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-sky-400">
            In flight
          </p>
          <h3 className="mt-0.5 text-sm font-bold text-white">{aircraft.model}</h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md px-1.5 py-0.5 text-slate-400 transition hover:bg-slate-800 hover:text-white"
          aria-label="Close"
        >
          ✕
        </button>
      </div>

      <dl className="mt-3 space-y-1.5 text-xs text-slate-300">
        <Row k="Route" v={routeLabel} />
        <Row k="Leg" v={legLabel} />
        <Row k="Progress" v={`${progressPct}%`} accent="text-emerald-400" />
        <Row k="ETA" v={eta} mono />
        <Row k="Heading" v={`${Math.round(aircraft.heading)}°`} mono />
      </dl>

      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-800">
        <div
          className="h-full rounded-full bg-gradient-to-r from-sky-600 to-sky-400 transition-[width] duration-300"
          style={{ width: `${progressPct}%` }}
        />
      </div>
    </div>
  )
}

function Row({
  k,
  v,
  accent,
  mono,
}: {
  k: string
  v: string
  accent?: string
  mono?: boolean
}) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-slate-500">{k}</dt>
      <dd
        className={[
          'font-medium',
          mono ? 'font-mono tabular-nums' : '',
          accent ?? 'text-slate-200',
        ].join(' ')}
      >
        {v}
      </dd>
    </div>
  )
}
