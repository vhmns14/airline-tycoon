/**
 * Finance books — KPI cards + ledger card.
 */

import { formatMoney, formatNumber } from '../../lib/format'
import { formatLocalTime } from '../../lib/time'
import { totalDebt } from '../../sim/bank'
import { useGameStore } from '../../store/gameStore'
import { GamePanel } from '../ui/GamePanel'
import { ScreenHeader } from '../ui/ScreenHeader'

export function FinancePanel() {
  const cash = useGameStore((s) => s.cash)
  const peakCash = useGameStore((s) => s.peakCash)
  const todayRevenue = useGameStore((s) => s.todayRevenue)
  const todayCosts = useGameStore((s) => s.todayCosts)
  const reputation = useGameStore((s) => s.reputation)
  const financeLog = useGameStore((s) => s.financeLog)
  const fuelStock = useGameStore((s) => s.fuelStock)
  const fuelPrice = useGameStore((s) => s.fuelPricePerLiter)
  const activeEvent = useGameStore((s) => s.activeEvent)
  const fleet = useGameStore((s) => s.ownedAircraft)
  const routes = useGameStore((s) => s.routes)
  const loans = useGameStore((s) => s.loans)

  const profit = todayRevenue - todayCosts
  const fuelValue = fuelStock * fuelPrice * (activeEvent?.fuelPriceMult ?? 1)
  const debt = totalDebt(loans)

  const kpis = [
    { label: 'Cash', value: formatMoney(cash), good: cash >= 0 },
    { label: 'Today rev', value: formatMoney(todayRevenue), good: true },
    { label: 'Today cost', value: formatMoney(todayCosts), good: false },
    { label: 'Profit', value: formatMoney(profit), good: profit >= 0 },
    { label: 'Peak', value: formatMoney(peakCash) },
    { label: 'Rep', value: `${reputation.toFixed(0)}` },
    { label: 'Fuel $', value: formatMoney(fuelValue) },
    { label: 'Bank debt', value: formatMoney(debt), good: debt <= 0 },
    {
      label: 'Flt / Rte',
      value: `${formatNumber(fleet.length)} / ${formatNumber(routes.length)}`,
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-12">
      <ScreenHeader
        title="📊 Books"
        sub="P&L · ledger · Bank for loans · local save"
      />

      {kpis.map((k) => (
        <div
          key={k.label}
          className="stat-card lg:col-span-2 sm:col-span-1"
          style={{
            ['--card-accent' as string]:
              k.good === true
                ? '#8fad7a'
                : k.good === false
                  ? '#b85c4a'
                  : '#c4a35a',
          }}
        >
          <p className="stat-card-label">{k.label}</p>
          <p
            className={[
              'stat-card-value',
              k.good === true
                ? 'text-[var(--game-cash)]'
                : k.good === false
                  ? 'text-[var(--game-danger)]'
                  : '',
            ].join(' ')}
          >
            {k.value}
          </p>
        </div>
      ))}

      <GamePanel
        title="Ledger"
        icon="📝"
        className="col-span-2 sm:col-span-3 lg:col-span-12"
      >
        {financeLog.length === 0 ? (
          <p className="text-sm text-[var(--game-dim)]">No entries yet.</p>
        ) : (
          <div className="max-h-[min(28rem,50vh)] overflow-auto">
            <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
              {financeLog.map((e) => (
                <div
                  key={e.id}
                  className="flex items-start justify-between gap-2 rounded-md border border-[rgba(160,145,120,0.15)] bg-black/15 px-2.5 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{e.label}</p>
                    <p className="text-xs text-[var(--game-dim)]">
                      {formatLocalTime(new Date(e.at))} · {e.kind}
                    </p>
                  </div>
                  <p
                    className={[
                      'shrink-0 font-display text-sm font-semibold tabular-nums',
                      e.amount >= 0
                        ? 'text-[var(--game-cash)]'
                        : 'text-[var(--game-danger)]',
                    ].join(' ')}
                  >
                    {e.amount >= 0 ? '+' : ''}
                    {formatMoney(e.amount)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </GamePanel>
    </div>
  )
}
