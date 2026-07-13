/**
 * Top HUD — resource chips like a tycoon game (cash, fuel, fleet).
 */

import { useEffect, useState } from 'react'
import { formatMoney, formatNumber } from '../../lib/format'
import { formatLocalTime } from '../../lib/time'
import { useGameStore } from '../../store/gameStore'
import { AccountMenu } from '../auth/AccountMenu'

export function TopBar() {
  const branding = useGameStore((s) => s.branding)
  const cash = useGameStore((s) => s.cash)
  const fuelStock = useGameStore((s) => s.fuelStock)
  const fuelCapacity = useGameStore((s) => s.fuelCapacity)
  const fuelPrice = useGameStore((s) => s.fuelPricePerLiter)
  const activeEvent = useGameStore((s) => s.activeEvent)
  const reputation = useGameStore((s) => s.reputation)
  const fleetCount = useGameStore((s) => s.ownedAircraft.length)
  const hangarSlots = useGameStore((s) => s.hangarSlots)
  const routeCount = useGameStore((s) => s.routes.length)
  const loans = useGameStore((s) => s.loans)
  const soundEnabled = useGameStore((s) => s.soundEnabled)
  const isPublic = useGameStore((s) => s.isPublic)
  const hubId = useGameStore((s) => s.hubId)
  const newGame = useGameStore((s) => s.newGame)
  const toggleSound = useGameStore((s) => s.toggleSound)
  const debt = loans.reduce((s, l) => s + l.remaining, 0)

  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(id)
  }, [])

  const effFuel = fuelPrice * (activeEvent?.fuelPriceMult ?? 1)
  const fuelPct = fuelCapacity > 0 ? fuelStock / fuelCapacity : 0

  function handleNewGame() {
    if (
      !window.confirm(
        'Start a new game? This erases your save (airline, fleet, routes).',
      )
    ) {
      return
    }
    newGame()
  }

  return (
    <header className="relative z-20 border-b border-[rgba(160,145,120,0.18)] bg-[#141210] px-1.5 py-1 sm:px-3 sm:py-1.5">
      <div className="flex items-center justify-between gap-1.5 sm:flex-wrap sm:gap-2">
        {/* Airline identity */}
        <div className="flex min-w-0 items-center gap-1.5 sm:gap-2.5">
          <div
            className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-base sm:h-10 sm:w-10 sm:text-xl"
            style={{
              background: branding.primaryColor,
              color: '#1a1714',
            }}
          >
            {branding.logoEmoji}
            <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border-2 border-[#141210] bg-[#8fad7a] sm:h-2.5 sm:w-2.5" />
          </div>
          <div className="min-w-0 max-w-[7.5rem] sm:max-w-none">
            <h1 className="font-display truncate text-xs font-semibold tracking-wide sm:text-base">
              {branding.name}
            </h1>
            <p className="flex flex-wrap items-center gap-x-1.5 text-[9px] text-[var(--game-dim)] sm:gap-x-2 sm:text-[10px]">
              <span className="tabular-nums text-[var(--game-brass)]">
                {formatLocalTime(now)}
              </span>
              <span className="hidden sm:inline">·</span>
              <span className="hidden sm:inline" title="Reputation">
                ★ {reputation.toFixed(0)}
              </span>
              {isPublic && (
                <span className="rounded bg-[rgba(196,163,90,0.15)] px-1 font-semibold uppercase tracking-wider text-[var(--game-brass)]">
                  IPO
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Resource HUD */}
        <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-1 sm:flex-none sm:gap-2">
          <HudChip
            icon="💵"
            label="Cash"
            value={formatMoney(cash)}
            valueClass={
              cash < 0
                ? 'text-[var(--game-danger)]'
                : cash > 0
                  ? 'text-[var(--game-cash)]'
                  : ''
            }
          />
          <HudChip
            icon="⛽"
            label="Fuel"
            value={`${formatNumber(Math.round(fuelStock))}L`}
            valueClass={
              fuelPct < 0.15
                ? 'text-[var(--game-warn)]'
                : 'text-[var(--game-fuel)]'
            }
            bar={fuelPct}
            barClass={
              fuelPct < 0.15 ? 'bg-[var(--game-warn)]' : 'bg-[var(--game-fuel)]'
            }
          />
          <HudChip
            icon="📉"
            label="$/L"
            value={formatMoney(effFuel)}
            valueClass="text-[var(--game-fuel)]"
            hideOnMobile
          />
          <HudChip
            icon="🛩"
            label="Fleet"
            value={`${fleetCount}/${hangarSlots}`}
            valueClass="text-[var(--game-brass)]"
          />
          <HudChip
            icon="🗺"
            label="Routes"
            value={formatNumber(routeCount)}
            valueClass="text-[var(--game-muted)]"
            hideOnMobile
          />
          {debt > 0 && (
            <HudChip
              icon="🏦"
              label="Debt"
              value={formatMoney(debt)}
              valueClass="text-amber-300"
            />
          )}

          <div className="ml-0.5 flex items-center gap-1 border-l border-slate-700/80 pl-1.5 sm:pl-2">
            <button
              type="button"
              onClick={() => toggleSound()}
              title={soundEnabled ? 'Mute' : 'Sound on'}
              className="btn-game btn-game-ghost !px-2 !py-1.5 text-sm"
            >
              {soundEnabled ? '🔊' : '🔇'}
            </button>
            <AccountMenu />
            <button
              type="button"
              onClick={handleNewGame}
              className="btn-game btn-game-ghost !px-2 !py-1.5 text-[10px]"
              title="New game"
            >
              ↺
            </button>
          </div>
        </div>
      </div>

      {/* tiny hub ticker */}
      {hubId && (
        <p className="mt-1 hidden text-[9px] uppercase tracking-[0.2em] text-slate-600 sm:block">
          Ops command · hub {hubId.toUpperCase()}
        </p>
      )}
    </header>
  )
}

function HudChip({
  icon,
  label,
  value,
  valueClass = '',
  bar,
  barClass,
  hideOnMobile,
}: {
  icon: string
  label: string
  value: string
  valueClass?: string
  bar?: number
  barClass?: string
  hideOnMobile?: boolean
}) {
  return (
    <div
      className={[
        'hud-chip !gap-1 !px-1.5 !py-0.5 sm:!gap-1.5 sm:!px-2 sm:!py-1',
        hideOnMobile ? 'hidden sm:flex' : '',
      ].join(' ')}
    >
      <span className="hud-chip-icon !h-5 !w-5 !text-xs sm:!h-6 sm:!w-6 sm:!text-sm">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="hud-chip-label !text-[9px] sm:!text-[11px]">{label}</p>
        <p
          className={`hud-chip-value !text-sm sm:!text-base ${valueClass}`}
        >
          {value}
        </p>
        {typeof bar === 'number' && (
          <div className="mt-0.5 h-0.5 w-full max-w-[3.5rem] overflow-hidden rounded-full bg-black/40 sm:max-w-[4.5rem]">
            <div
              className={`h-full rounded-full ${barClass ?? 'bg-[var(--game-brass)]'}`}
              style={{ width: `${Math.min(100, Math.max(0, bar * 100))}%` }}
            />
          </div>
        )}
      </div>
    </div>
  )
}
