/**
 * Full-screen bankrupt / game-over overlay with final stats + restart.
 */

import { formatMoney, formatNumber } from '../lib/format'
import { calendarDaysBetween } from '../lib/time'
import { useGameStore } from '../store/gameStore'

export function GameOverScreen() {
  const gameOver = useGameStore((s) => s.gameOver)
  const branding = useGameStore((s) => s.branding)
  const cash = useGameStore((s) => s.cash)
  const peakCash = useGameStore((s) => s.peakCash)
  const reputation = useGameStore((s) => s.reputation)
  const gameStartedAtMs = useGameStore((s) => s.gameStartedAtMs)
  const fleetCount = useGameStore((s) => s.ownedAircraft.length)
  const routeCount = useGameStore((s) => s.routes.length)
  const newGame = useGameStore((s) => s.newGame)

  if (!gameOver) return null

  const daysSurvived = calendarDaysBetween(gameStartedAtMs, Date.now())

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 p-4 backdrop-blur-md animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="game-over-title"
    >
      <div className="game-panel w-full max-w-md animate-scale-in !border-red-500/40 p-6 shadow-[0_0_60px_rgba(185,28,28,0.35)]">
        <p className="text-center font-display text-[10px] font-bold uppercase tracking-[0.3em] text-red-400">
          Mission failed
        </p>
        <h2
          id="game-over-title"
          className="mt-2 text-center font-display text-3xl font-bold tracking-wide text-slate-50"
        >
          Bankrupt
        </h2>
        <p className="mt-1 text-center text-sm text-slate-300">
          {branding.logoEmoji} {branding.name}
        </p>
        <p className="mt-3 text-center text-sm text-slate-400">
          Your airline ran out of cash. Creditors grounded the fleet.
        </p>

        <dl className="mt-6 grid grid-cols-2 gap-3">
          <StatCard
            label="Days survived"
            value={formatNumber(daysSurvived)}
          />
          <StatCard
            label="Peak cash"
            value={formatMoney(peakCash)}
            valueClassName="text-emerald-400"
          />
          <StatCard
            label="Final cash"
            value={formatMoney(cash)}
            valueClassName="text-red-400"
          />
          <StatCard
            label="Reputation"
            value={`${reputation.toFixed(0)}/100`}
          />
          <StatCard
            label="Fleet / routes"
            value={`${formatNumber(fleetCount)} / ${formatNumber(routeCount)}`}
          />
        </dl>

        <button
          type="button"
          onClick={() => newGame()}
          className="btn-game btn-game-primary mt-6 w-full !py-3 !text-sm"
        >
          ↺ Restart career
        </button>
      </div>
    </div>
  )
}

function StatCard({
  label,
  value,
  valueClassName = 'text-slate-100',
}: {
  label: string
  value: string
  valueClassName?: string
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-3 transition duration-200">
      <dt className="text-[0.65rem] font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </dt>
      <dd
        className={`mt-1 text-lg font-bold tabular-nums ${valueClassName}`}
      >
        {value}
      </dd>
    </div>
  )
}
