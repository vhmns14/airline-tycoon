/**
 * SkyBank — card grid for credit + loan packages.
 */

import { useMemo, useState } from 'react'
import { formatMoney, formatNumber } from '../../lib/format'
import {
  annualizedPct,
  availableCredit,
  LOAN_PRODUCTS,
  maxCreditLine,
  MAX_ACTIVE_LOANS,
  totalDebt,
} from '../../sim/bank'
import { useGameStore } from '../../store/gameStore'
import { GamePanel } from '../ui/GamePanel'
import { ScreenHeader } from '../ui/ScreenHeader'

export function BankPanel() {
  const cash = useGameStore((s) => s.cash)
  const peakCash = useGameStore((s) => s.peakCash)
  const reputation = useGameStore((s) => s.reputation)
  const fleet = useGameStore((s) => s.ownedAircraft)
  const loans = useGameStore((s) => s.loans)
  const gameOver = useGameStore((s) => s.gameOver)
  const takeLoan = useGameStore((s) => s.takeLoan)
  const repayLoan = useGameStore((s) => s.repayLoan)

  const [msg, setMsg] = useState<string | null>(null)
  const [customAmt, setCustomAmt] = useState<Record<string, string>>({})

  const maxLine = useMemo(
    () =>
      maxCreditLine({
        reputation,
        peakCash,
        cash,
        fleet,
      }),
    [reputation, peakCash, cash, fleet],
  )
  const debt = totalDebt(loans)
  const room = availableCredit(loans, maxLine)
  const usedPct = maxLine > 0 ? Math.min(100, (debt / maxLine) * 100) : 0

  function borrow(productId: string, maxAmount: number) {
    setMsg(null)
    const raw = customAmt[productId]
    const amount =
      raw && Number.isFinite(Number(raw)) && Number(raw) > 0
        ? Number(raw)
        : maxAmount
    const ok = takeLoan(productId, amount)
    setMsg(
      ok
        ? `Borrowed ${formatMoney(Math.min(amount, maxAmount, room))}`
        : 'Loan denied — check rep, credit line, or max loans.',
    )
  }

  function payPartial(loanId: string, remaining: number) {
    setMsg(null)
    const chunk = Math.min(
      remaining,
      cash,
      Math.max(10_000, Math.round(remaining / 4)),
    )
    const ok = repayLoan(loanId, chunk)
    setMsg(
      ok
        ? `Paid ${formatMoney(chunk)} toward principal.`
        : 'Cannot repay (need cash).',
    )
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-12">
      <ScreenHeader
        title="🏦 SkyBank"
        sub="Borrow · interest every real 24h · repay anytime"
        right={
          <span className="text-sm tabular-nums text-[var(--game-cash)]">
            Cash {formatMoney(cash)}
          </span>
        }
      />

      {msg && (
        <p className="col-span-full rounded-md border border-[rgba(196,163,90,0.25)] bg-[rgba(196,163,90,0.08)] px-3 py-2 text-sm">
          {msg}
        </p>
      )}

      <GamePanel title="Credit line" icon="📈" className="sm:col-span-2 lg:col-span-4">
        <p className="text-sm text-[var(--game-muted)]">
          {formatMoney(debt)} / {formatMoney(maxLine)} used
        </p>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-black/40">
          <div
            className="h-full rounded-full transition-[width]"
            style={{
              width: `${usedPct}%`,
              background:
                usedPct > 85
                  ? 'var(--game-danger)'
                  : usedPct > 50
                    ? 'var(--game-warn)'
                    : 'var(--game-cash)',
            }}
          />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
          <div>
            <p className="text-xs text-[var(--game-dim)]">Available</p>
            <p className="font-display font-semibold text-[var(--game-cash)]">
              {formatMoney(room)}
            </p>
          </div>
          <div>
            <p className="text-xs text-[var(--game-dim)]">Debt</p>
            <p className="font-display font-semibold text-[var(--game-warn)]">
              {formatMoney(debt)}
            </p>
          </div>
          <div>
            <p className="text-xs text-[var(--game-dim)]">Loans</p>
            <p className="font-display font-semibold">
              {formatNumber(loans.length)}/{MAX_ACTIVE_LOANS}
            </p>
          </div>
          <div>
            <p className="text-xs text-[var(--game-dim)]">Rep</p>
            <p className="font-display font-semibold">{reputation.toFixed(0)}</p>
          </div>
        </div>
      </GamePanel>

      <div className="sm:col-span-2 lg:col-span-8">
        <p className="mb-2 font-display text-sm font-semibold uppercase tracking-wide text-[var(--game-brass)]">
          Loan packages
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {LOAN_PRODUCTS.map((p) => {
            const locked = reputation < p.minRep
            const capped = Math.min(p.amount, room)
            const can =
              !gameOver &&
              !locked &&
              capped >= 10_000 &&
              loans.length < MAX_ACTIVE_LOANS
            return (
              <div key={p.id} className="game-panel">
                <div className="game-panel-body">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-base font-semibold">{p.label}</p>
                      <p className="text-sm text-[var(--game-muted)]">
                        {p.blurb}
                      </p>
                    </div>
                    <div className="text-right text-sm tabular-nums">
                      <p>up to {formatMoney(p.amount)}</p>
                      <p className="text-[var(--game-brass)]">
                        {annualizedPct(p.dailyRate).toFixed(0)}% APR
                      </p>
                    </div>
                  </div>
                  <p className="mt-1 text-xs text-[var(--game-dim)]">
                    {(p.dailyRate * 100).toFixed(2)}%/day · min rep {p.minRep}
                    {locked && (
                      <span className="text-[var(--game-danger)]"> · locked</span>
                    )}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <input
                      type="number"
                      min={10_000}
                      max={p.amount}
                      step={10_000}
                      placeholder={String(Math.min(p.amount, room || p.amount))}
                      value={customAmt[p.id] ?? ''}
                      onChange={(e) =>
                        setCustomAmt((m) => ({ ...m, [p.id]: e.target.value }))
                      }
                      className="game-input !w-28 !py-1.5 text-sm"
                    />
                    <button
                      type="button"
                      disabled={!can}
                      onClick={() => borrow(p.id, p.amount)}
                      className={[
                        'btn-game !text-sm',
                        can ? 'btn-game-success' : 'btn-game-ghost',
                      ].join(' ')}
                    >
                      Borrow
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <GamePanel
        title="Outstanding loans"
        icon="📋"
        className="sm:col-span-2 lg:col-span-12"
      >
        {loans.length === 0 ? (
          <p className="text-sm text-[var(--game-dim)]">
            No debt — accountant is happy (for now).
          </p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {loans.map((l) => (
              <div
                key={l.id}
                className="rounded-md border border-[rgba(160,145,120,0.18)] bg-black/20 px-3 py-2.5"
              >
                <p className="font-semibold">{l.label}</p>
                <p className="mt-1 text-sm text-[var(--game-muted)]">
                  Owed{' '}
                  <span className="font-display text-[var(--game-warn)]">
                    {formatMoney(l.remaining)}
                  </span>{' '}
                  · {(l.dailyRate * 100).toFixed(2)}%/d
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    disabled={gameOver || cash <= 0}
                    onClick={() => payPartial(l.id, l.remaining)}
                    className="btn-game btn-game-ghost !py-1 !text-xs"
                  >
                    Pay ~25%
                  </button>
                  <button
                    type="button"
                    disabled={gameOver || cash < 1}
                    onClick={() => {
                      const ok = repayLoan(l.id, l.remaining)
                      setMsg(
                        ok
                          ? 'Loan cleared!'
                          : 'Not enough cash to clear full principal.',
                      )
                    }}
                    className="btn-game btn-game-primary !py-1 !text-xs"
                  >
                    Pay max
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        <p className="mt-2 text-xs text-[var(--game-dim)]">
          Interest billed every real 24h. Credit grows with rep, peak cash, fleet.
        </p>
      </GamePanel>
    </div>
  )
}
