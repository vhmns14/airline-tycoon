/**
 * Admin console — who is playing (cloud accounts + save snapshots).
 */

import { useCallback, useEffect, useState } from 'react'
import { formatMoney } from '../../lib/format'
import {
  apiAdminGrantCash,
  apiAdminPlayers,
  apiChangePassword,
  type AdminPlayer,
} from '../../lib/api'
import { useAuthStore } from '../../store/authStore'

const PRESETS = [50_000, 100_000, 250_000, 500_000, 1_000_000]

function fmtWhen(ts: number | null | undefined): string {
  if (ts == null) return '—'
  const d = new Date(ts)
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function relative(ts: number | null | undefined): string {
  if (ts == null) return 'never'
  const sec = Math.max(0, Math.floor((Date.now() - ts) / 1000))
  if (sec < 60) return `${sec}s ago`
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`
  return `${Math.floor(sec / 86400)}d ago`
}

export function AdminPanel() {
  const token = useAuthStore((s) => s.token)
  const user = useAuthStore((s) => s.user)
  const [players, setPlayers] = useState<AdminPlayer[]>([])
  const [total, setTotal] = useState(0)
  const [withSave, setWithSave] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [curPw, setCurPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [pwMsg, setPwMsg] = useState<string | null>(null)
  const [pwBusy, setPwBusy] = useState(false)
  const [grantUserId, setGrantUserId] = useState<string>('')
  const [grantAmount, setGrantAmount] = useState('100000')
  const [grantNote, setGrantNote] = useState('')
  const [grantMsg, setGrantMsg] = useState<string | null>(null)
  const [grantBusy, setGrantBusy] = useState(false)

  const load = useCallback(async () => {
    if (!token) {
      setError('Log in as admin first.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await apiAdminPlayers(token)
      setPlayers(res.players)
      setTotal(res.total)
      setWithSave(res.withSave)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load players')
      setPlayers([])
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    void load()
  }, [load])

  if (!user?.isAdmin) {
    return (
      <div className="game-panel p-6 text-center">
        <p className="font-display text-lg text-[var(--game-brass)]">Admin only</p>
        <p className="mt-1 text-sm text-[var(--game-muted)]">
          Log in with an admin account to see who is playing.
        </p>
      </div>
    )
  }

  const filtered = players.filter((p) => {
    if (!q.trim()) return true
    const s = q.trim().toLowerCase()
    return (
      p.username.toLowerCase().includes(s) ||
      (p.airlineName?.toLowerCase().includes(s) ?? false) ||
      (p.hubId?.toLowerCase().includes(s) ?? false)
    )
  })

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="screen-title">🛡 Admin</h2>
          <p className="screen-sub">
            Cloud accounts · last save snapshot ·{' '}
            <span className="text-[var(--game-brass)]">@{user.username}</span>
          </p>
        </div>
        <button
          type="button"
          className="btn-game btn-game-primary !text-xs"
          onClick={() => void load()}
          disabled={loading}
        >
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Stat label="Accounts" value={String(total)} />
        <Stat label="With cloud save" value={String(withSave)} />
        <Stat
          label="Admins"
          value={String(players.filter((p) => p.isAdmin).length)}
        />
      </div>

      <div className="game-panel">
        <div className="game-panel-header">
          <h3 className="game-panel-title">Change password</h3>
        </div>
        <div className="game-panel-body">
          <form
            className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end"
            onSubmit={async (e) => {
              e.preventDefault()
              if (!token) return
              setPwBusy(true)
              setPwMsg(null)
              try {
                await apiChangePassword(token, curPw, newPw)
                setPwMsg('Password updated. Use the new one next login.')
                setCurPw('')
                setNewPw('')
              } catch (err) {
                setPwMsg(
                  err instanceof Error ? err.message : 'Failed to change password',
                )
              } finally {
                setPwBusy(false)
              }
            }}
          >
            <label className="min-w-[10rem] flex-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--game-dim)]">
                Current
              </span>
              <input
                type="password"
                className="game-input mt-0.5 w-full !py-1.5"
                value={curPw}
                onChange={(e) => setCurPw(e.target.value)}
                autoComplete="current-password"
                required
              />
            </label>
            <label className="min-w-[10rem] flex-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--game-dim)]">
                New (min 6)
              </span>
              <input
                type="password"
                className="game-input mt-0.5 w-full !py-1.5"
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                autoComplete="new-password"
                minLength={6}
                required
              />
            </label>
            <button
              type="submit"
              className="btn-game btn-game-primary !min-h-[2.5rem] !text-xs"
              disabled={pwBusy}
            >
              {pwBusy ? 'Saving…' : 'Update password'}
            </button>
          </form>
          {pwMsg && (
            <p className="mt-2 text-xs text-[var(--game-olive)]">{pwMsg}</p>
          )}
        </div>
      </div>

      {/* Gift money */}
      <div className="game-panel">
        <div className="game-panel-header">
          <h3 className="game-panel-title">💵 Gift cash</h3>
          <span className="text-[10px] text-[var(--game-dim)]">
            Applies on player cloud sync (~4s if online)
          </span>
        </div>
        <div className="game-panel-body space-y-2">
          <form
            className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end"
            onSubmit={async (e) => {
              e.preventDefault()
              if (!token || !grantUserId) return
              const amount = Number(grantAmount.replace(/,/g, ''))
              if (!Number.isFinite(amount) || amount === 0) {
                setGrantMsg('Enter a non-zero amount.')
                return
              }
              setGrantBusy(true)
              setGrantMsg(null)
              try {
                const res = await apiAdminGrantCash(token, {
                  userId: grantUserId,
                  amount,
                  note: grantNote.trim() || undefined,
                })
                setGrantMsg(res.message)
                setGrantNote('')
                await load()
              } catch (err) {
                setGrantMsg(
                  err instanceof Error ? err.message : 'Grant failed',
                )
              } finally {
                setGrantBusy(false)
              }
            }}
          >
            <label className="min-w-[12rem] flex-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--game-dim)]">
                Player
              </span>
              <select
                className="game-input mt-0.5 w-full !py-1.5"
                value={grantUserId}
                onChange={(e) => setGrantUserId(e.target.value)}
                required
              >
                <option value="">Select player…</option>
                {players.map((p) => (
                  <option key={p.id} value={p.id}>
                    @{p.username}
                    {p.airlineName ? ` · ${p.airlineName}` : ''}
                    {p.cash != null ? ` · ${formatMoney(p.cash)}` : ''}
                    {(p.pendingCash ?? 0) > 0
                      ? ` · pending +${formatMoney(p.pendingCash)}`
                      : ''}
                  </option>
                ))}
              </select>
            </label>
            <label className="min-w-[8rem] w-full sm:w-40">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--game-dim)]">
                Amount ($)
              </span>
              <input
                className="game-input mt-0.5 w-full !py-1.5"
                inputMode="decimal"
                value={grantAmount}
                onChange={(e) => setGrantAmount(e.target.value)}
                placeholder="100000"
                required
              />
            </label>
            <label className="min-w-[10rem] flex-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--game-dim)]">
                Note (optional)
              </span>
              <input
                className="game-input mt-0.5 w-full !py-1.5"
                value={grantNote}
                onChange={(e) => setGrantNote(e.target.value)}
                placeholder="Season reward, bug fix…"
                maxLength={120}
              />
            </label>
            <button
              type="submit"
              className="btn-game btn-game-success !min-h-[2.5rem] !text-xs"
              disabled={grantBusy || !grantUserId}
            >
              {grantBusy ? 'Sending…' : 'Send cash'}
            </button>
          </form>
          <div className="flex flex-wrap gap-1">
            {PRESETS.map((n) => (
              <button
                key={n}
                type="button"
                className="btn-game btn-game-ghost !py-1 !text-[10px]"
                onClick={() => setGrantAmount(String(n))}
              >
                +{formatMoney(n)}
              </button>
            ))}
            <button
              type="button"
              className="btn-game btn-game-ghost !py-1 !text-[10px]"
              onClick={() =>
                setGrantAmount((a) => {
                  const n = Number(a)
                  return Number.isFinite(n) ? String(-Math.abs(n)) : '-100000'
                })
              }
              title="Fine / remove cash"
            >
              Fine (−)
            </button>
          </div>
          {grantMsg && (
            <p className="text-xs text-[var(--game-olive)]">{grantMsg}</p>
          )}
        </div>
      </div>

      <div className="game-panel">
        <div className="game-panel-header flex-wrap gap-2">
          <h3 className="game-panel-title">Players</h3>
          <input
            className="game-input !w-full max-w-xs !py-1.5 !text-sm sm:!w-56"
            placeholder="Search user / airline / hub…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div className="game-panel-body !p-0">
          {error && (
            <p className="px-3 py-2 text-sm text-[var(--game-danger)]">{error}</p>
          )}
          {loading && players.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-[var(--game-dim)]">
              Loading…
            </p>
          ) : filtered.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-[var(--game-dim)]">
              No players yet. They show up after someone registers + cloud saves.
            </p>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden overflow-x-auto sm:block">
                <table className="w-full min-w-[820px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-[rgba(160,145,120,0.15)] text-[10px] uppercase tracking-wider text-[var(--game-dim)]">
                      <th className="px-3 py-2 font-semibold">User</th>
                      <th className="px-3 py-2 font-semibold">Airline</th>
                      <th className="px-3 py-2 font-semibold">Hub</th>
                      <th className="px-3 py-2 font-semibold">Cash</th>
                      <th className="px-3 py-2 font-semibold">Pending</th>
                      <th className="px-3 py-2 font-semibold">Fleet</th>
                      <th className="px-3 py-2 font-semibold">Routes</th>
                      <th className="px-3 py-2 font-semibold">Last save</th>
                      <th className="px-3 py-2 font-semibold">Gift</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((p) => (
                      <tr
                        key={p.id}
                        className={[
                          'border-b border-[rgba(160,145,120,0.08)] hover:bg-black/15',
                          grantUserId === p.id ? 'bg-[rgba(196,163,90,0.08)]' : '',
                        ].join(' ')}
                      >
                        <td className="px-3 py-2">
                          <span className="font-semibold">@{p.username}</span>
                          {p.isAdmin && (
                            <span className="ml-1.5 rounded bg-[rgba(196,163,90,0.2)] px-1 text-[9px] font-bold uppercase text-[var(--game-brass)]">
                              admin
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-[var(--game-muted)]">
                          {p.airlineName ?? (
                            <span className="text-[var(--game-dim)]">
                              {p.setupComplete === false
                                ? 'not founded'
                                : '—'}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 font-mono text-xs uppercase">
                          {p.hubId ?? '—'}
                        </td>
                        <td className="px-3 py-2 tabular-nums text-[var(--game-cash)]">
                          {p.cash != null ? formatMoney(p.cash) : '—'}
                        </td>
                        <td className="px-3 py-2 tabular-nums text-[var(--game-brass)]">
                          {(p.pendingCash ?? 0) !== 0
                            ? formatMoney(p.pendingCash)
                            : '—'}
                        </td>
                        <td className="px-3 py-2 tabular-nums">{p.fleet ?? '—'}</td>
                        <td className="px-3 py-2 tabular-nums">
                          {p.routes ?? '—'}
                        </td>
                        <td
                          className="px-3 py-2 text-xs text-[var(--game-muted)]"
                          title={fmtWhen(p.saveUpdatedAt)}
                        >
                          {relative(p.saveUpdatedAt)}
                        </td>
                        <td className="px-3 py-2">
                          <button
                            type="button"
                            className="btn-game btn-game-ghost !px-2 !py-1 !text-[10px]"
                            onClick={() => setGrantUserId(p.id)}
                          >
                            Select
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <ul className="divide-y divide-[rgba(160,145,120,0.1)] sm:hidden">
                {filtered.map((p) => (
                  <li key={p.id} className="px-3 py-2.5">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-semibold">
                        @{p.username}
                        {p.isAdmin && (
                          <span className="ml-1 text-[9px] uppercase text-[var(--game-brass)]">
                            admin
                          </span>
                        )}
                      </span>
                      <button
                        type="button"
                        className="btn-game btn-game-ghost !px-2 !py-0.5 !text-[10px]"
                        onClick={() => setGrantUserId(p.id)}
                      >
                        Gift
                      </button>
                    </div>
                    <p className="mt-0.5 text-xs text-[var(--game-muted)]">
                      {p.airlineName ?? 'no airline'} · hub{' '}
                      {(p.hubId ?? '—').toUpperCase()}
                    </p>
                    <p className="mt-0.5 text-[11px] tabular-nums text-[var(--game-dim)]">
                      {p.cash != null ? formatMoney(p.cash) : '— cash'}
                      {(p.pendingCash ?? 0) !== 0
                        ? ` · pending ${formatMoney(p.pendingCash)}`
                        : ''}{' '}
                      · {p.fleet ?? 0} fleet · {p.routes ?? 0} routes
                    </p>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>

      <p className="text-[10px] text-[var(--game-dim)]">
        Cash gifts queue until the player&apos;s next cloud sync (auto ~4s while
        logged in). Guest-only play without login is not on this list.
      </p>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat-card" style={{ ['--card-accent' as string]: '#c4a35a' }}>
      <p className="stat-card-label">{label}</p>
      <p className="mt-0.5 font-display text-xl font-semibold tabular-nums">
        {value}
      </p>
    </div>
  )
}
