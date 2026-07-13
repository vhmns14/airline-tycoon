/**
 * Full-screen founding / new-game screen (exclusive — no game HUD behind).
 */

import { useState } from 'react'
import { airports } from '../../data/airports'
import { DIFFICULTY } from '../../sim/difficulty'
import { useGameStore } from '../../store/gameStore'
import type { Difficulty } from '../../types'
import { formatMoney, formatNumber } from '../../lib/format'

const EMOJIS = ['✈', '🛫', '🛩', '🌏', '⭐', '🔥', '🦅', '🦁', '💎', '🌊']

export function SetupModal() {
  const completeSetup = useGameStore((s) => s.completeSetup)
  const [name, setName] = useState('Nusantara Air')
  const [slogan, setSlogan] = useState('Connecting the archipelago')
  const [logoEmoji, setLogoEmoji] = useState('✈')
  const [primaryColor, setPrimaryColor] = useState('#c4a35a')
  const [secondaryColor, setSecondaryColor] = useState('#1c1916')
  const [hubId, setHubId] = useState('cgk')
  const [difficulty, setDifficulty] = useState<Difficulty>('normal')
  const [error, setError] = useState<string | null>(null)

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const ok = completeSetup(
      { name, slogan, logoEmoji, primaryColor, secondaryColor },
      hubId,
      difficulty,
    )
    if (!ok) setError('Pilih nama maskapai dan hub yang valid.')
  }

  return (
    <div className="relative flex min-h-screen w-full items-start justify-center overflow-auto px-3 py-6 sm:items-center sm:px-6 sm:py-8">
      {/* Full-viewport hangar backdrop */}
      <div className="pointer-events-none fixed inset-0 bg-[#12100e]" />
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_50%_20%,rgba(90,70,40,0.22),transparent_55%)]" />
      <div className="pointer-events-none fixed inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/70 to-transparent" />

      <form
        onSubmit={submit}
        className="game-panel relative z-10 w-full max-w-lg"
      >
        <div className="border-b border-[rgba(160,145,120,0.18)] bg-[rgba(0,0,0,0.2)] px-5 py-5 text-center sm:px-6">
          <p className="font-display text-[10px] font-semibold uppercase tracking-[0.3em] text-[var(--game-brass)]">
            Airline Tycoon
          </p>
          <h2 className="mt-2 font-display text-2xl font-semibold tracking-wide sm:text-3xl">
            Found your airline
          </h2>
          <p className="mt-1.5 text-sm text-[var(--game-muted)]">
            Brand · hub · difficulty — then take the skies.
          </p>
        </div>

        <div className="space-y-4 px-5 py-4 sm:px-6 sm:py-5">
          <label className="block">
            <span className="font-display text-[10px] font-bold uppercase tracking-widest text-slate-500">
              Airline name
            </span>
            <input
              className="game-input mt-1"
              value={name}
              maxLength={40}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
            />
          </label>

          <label className="block">
            <span className="font-display text-[10px] font-bold uppercase tracking-widest text-slate-500">
              Slogan
            </span>
            <input
              className="game-input mt-1"
              value={slogan}
              maxLength={60}
              onChange={(e) => setSlogan(e.target.value)}
            />
          </label>

          <div>
            <span className="font-display text-[10px] font-bold uppercase tracking-widest text-slate-500">
              Emblem
            </span>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {EMOJIS.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => setLogoEmoji(e)}
                  className={[
                    'flex h-11 w-11 items-center justify-center rounded-xl border text-lg transition',
                    logoEmoji === e
                      ? 'border-[var(--game-brass)] bg-[rgba(196,163,90,0.15)]'
                      : 'border-[rgba(160,145,120,0.2)] bg-black/30 hover:border-[rgba(160,145,120,0.4)]',
                  ].join(' ')}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label>
              <span className="font-display text-[10px] font-semibold uppercase tracking-widest text-[var(--game-dim)]">
                Primary
              </span>
              <input
                type="color"
                className="mt-1 h-11 w-full cursor-pointer rounded-md border border-[rgba(160,145,120,0.2)] bg-[#141210]"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
              />
            </label>
            <label>
              <span className="font-display text-[10px] font-semibold uppercase tracking-widest text-[var(--game-dim)]">
                Secondary
              </span>
              <input
                type="color"
                className="mt-1 h-11 w-full cursor-pointer rounded-md border border-[rgba(160,145,120,0.2)] bg-[#141210]"
                value={secondaryColor}
                onChange={(e) => setSecondaryColor(e.target.value)}
              />
            </label>
          </div>

          <label className="block">
            <span className="font-display text-[10px] font-bold uppercase tracking-widest text-slate-500">
              Home hub
            </span>
            <select
              className="game-input mt-1"
              value={hubId}
              onChange={(e) => setHubId(e.target.value)}
            >
              {airports
                .filter((a) => a.size >= 3)
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.code} — {a.city}
                  </option>
                ))}
            </select>
          </label>

          <div>
            <span className="font-display text-[10px] font-bold uppercase tracking-widest text-slate-500">
              Difficulty
            </span>
            <div className="mt-1.5 grid gap-2 sm:grid-cols-3">
              {(Object.keys(DIFFICULTY) as Difficulty[]).map((id) => {
                const p = DIFFICULTY[id]
                const active = difficulty === id
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setDifficulty(id)}
                    className={[
                      'rounded-xl border px-2.5 py-2.5 text-left transition',
                      active
                        ? 'border-[var(--game-brass)] bg-[rgba(196,163,90,0.12)]'
                        : 'border-[rgba(160,145,120,0.2)] bg-black/25 hover:border-[rgba(160,145,120,0.35)]',
                    ].join(' ')}
                  >
                    <p className="font-display text-xs font-semibold">
                      {p.label}
                    </p>
                    <p className="mt-0.5 text-[10px] leading-snug text-[var(--game-muted)]">
                      {p.blurb}
                    </p>
                    <p className="mt-1.5 font-display text-[9px] tabular-nums text-[var(--game-brass)]">
                      {formatMoney(p.cash)} · {formatNumber(p.fuel)}L
                    </p>
                  </button>
                )
              })}
            </div>
          </div>

          <div
            className="flex items-center gap-3 rounded-xl border p-3"
            style={{
              borderColor: `${primaryColor}66`,
              background: `linear-gradient(135deg, ${primaryColor}22, transparent)`,
            }}
          >
            <span
              className="flex h-14 w-14 items-center justify-center rounded-xl text-2xl shadow-lg"
              style={{
                background: `linear-gradient(145deg, ${primaryColor}, ${secondaryColor})`,
              }}
            >
              {logoEmoji}
            </span>
            <div>
              <p className="font-display text-lg font-bold text-white">
                {name || 'Airline'}
              </p>
              <p className="text-sm italic text-slate-400">{slogan}</p>
            </div>
          </div>

          {error && (
            <p className="text-center text-sm font-semibold text-red-400">
              {error}
            </p>
          )}

          <button
            type="submit"
            className="btn-game btn-game-primary w-full !py-3.5 !text-sm"
          >
            🚀 Launch airline
          </button>
        </div>
      </form>
    </div>
  )
}
