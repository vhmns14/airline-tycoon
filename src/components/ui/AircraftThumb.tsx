/**
 * Small aircraft type image (side-view illustration) with SVG fallback.
 */

import { useState } from 'react'
import type { Aircraft, AircraftBodyClass } from '../../types'

const SIZE = {
  sm: { w: 56, h: 32 },
  md: { w: 72, h: 40 },
  lg: { w: 96, h: 52 },
} as const

type AircraftThumbProps = {
  plane: Pick<
    Aircraft,
    'bodyClass' | 'role' | 'manufacturer' | 'model' | 'imageKey' | 'id'
  >
  size?: keyof typeof SIZE
  className?: string
}

const MAKER_FILL: Record<string, string> = {
  Boeing: '#3b82f6',
  Airbus: '#0ea5e9',
  Embraer: '#34d399',
  ATR: '#38bdf8',
  Bombardier: '#818cf8',
  Cessna: '#94a3b8',
  'de Havilland': '#64748b',
  Beechcraft: '#a8a29e',
  Douglas: '#c4b5fd',
  Fokker: '#67e8f9',
  'British Aerospace': '#f9a8d4',
  'McDonnell Douglas': '#fbbf24',
  Pilatus: '#a5b4fc',
  Quest: '#86efac',
  'Britten-Norman': '#fca5a5',
  Dornier: '#7dd3fc',
  CASA: '#6ee7b7',
  IPTN: '#fb7185',
  Let: '#93c5fd',
  Antonov: '#fcd34d',
  GAF: '#c4b5fd',
  'Short Brothers': '#d8b4fe',
}

/** Resolve public image path for a catalog entry. */
export function aircraftImageUrl(
  plane: Pick<Aircraft, 'imageKey' | 'id'>,
): string {
  const key = plane.imageKey || plane.id
  return `/aircraft/${key}.jpg`
}

export function AircraftThumb({
  plane,
  size = 'sm',
  className = '',
}: AircraftThumbProps) {
  const dim = SIZE[size]
  const [failed, setFailed] = useState(false)
  const src = aircraftImageUrl(plane)

  if (failed) {
    return (
      <span
        className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded bg-slate-950/80 ring-1 ring-slate-700/80 ${className}`}
        style={{ width: dim.w, height: dim.h }}
        title={plane.model}
        aria-hidden
      >
        <svg
          width={dim.w - 6}
          height={dim.h - 6}
          viewBox="0 0 48 48"
          fill="none"
        >
          <Silhouette
            body={plane.bodyClass ?? 'narrowbody'}
            fill={
              MAKER_FILL[plane.manufacturer] ??
              (plane.role === 'cargo' ? '#fb923c' : '#7dd3fc')
            }
            cargo={plane.role === 'cargo'}
          />
        </svg>
      </span>
    )
  }

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded bg-slate-950 ring-1 ring-slate-700/80 ${className}`}
      style={{ width: dim.w, height: dim.h }}
      title={plane.model}
    >
      <img
        src={src}
        alt=""
        width={dim.w}
        height={dim.h}
        className="h-full w-full object-cover object-center"
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
      />
    </span>
  )
}

function Silhouette({
  body,
  fill,
  cargo,
}: {
  body: AircraftBodyClass
  fill: string
  cargo: boolean
}) {
  const scale =
    body === 'light'
      ? 0.72
      : body === 'turboprop'
        ? 0.82
        : body === 'regional'
          ? 0.9
          : body === 'narrowbody'
            ? 1
            : body === 'widebody'
              ? 1.08
              : 1.15
  const fuselageY = body === 'super' ? 23 : 24
  const fuselageH = body === 'super' ? 7 : body === 'widebody' ? 6 : 5
  const wingSpan =
    body === 'light'
      ? 14
      : body === 'turboprop'
        ? 16
        : body === 'super'
          ? 22
          : 18

  return (
    <g transform={`translate(24 24) scale(${scale}) translate(-24 -24)`}>
      <ellipse
        cx="24"
        cy={fuselageY + 1}
        rx={wingSpan}
        ry={body === 'light' ? 2.2 : 3}
        fill={fill}
        opacity={0.85}
      />
      <ellipse
        cx="10"
        cy={fuselageY - 2}
        rx={body === 'super' ? 7 : 5}
        ry="1.6"
        fill={fill}
        opacity={0.75}
      />
      <path
        d={`M8 ${fuselageY - 1} L6 ${fuselageY - 10} L12 ${fuselageY - 1} Z`}
        fill={fill}
      />
      <rect
        x="8"
        y={fuselageY - fuselageH / 2}
        width="32"
        height={fuselageH}
        rx={fuselageH / 2}
        fill={fill}
      />
      <ellipse
        cx="40"
        cy={fuselageY}
        rx={body === 'light' ? 3 : 4}
        ry={fuselageH / 2}
        fill={fill}
      />
      {cargo && (
        <rect
          x="14"
          y={fuselageY - 0.6}
          width="18"
          height="1.2"
          fill="#0f172a"
          opacity={0.45}
        />
      )}
    </g>
  )
}
