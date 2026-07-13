/**
 * Game-style icon navigation — rail on desktop, bottom dock on mobile.
 * Mobile: 5 primary tabs + “More” sheet for the rest.
 */

import { useEffect, useState } from 'react'

export type AppTab =
  | 'dashboard'
  | 'map'
  | 'hub'
  | 'fleet'
  | 'market'
  | 'fuel'
  | 'routes'
  | 'company'
  | 'bank'
  | 'finance'

const TABS: { id: AppTab; label: string; short: string; icon: string }[] = [
  { id: 'dashboard', label: 'Ops', short: 'Ops', icon: '📡' },
  { id: 'map', label: 'Map', short: 'Map', icon: '🌍' },
  { id: 'hub', label: 'Hub', short: 'Hub', icon: '🏢' },
  { id: 'fleet', label: 'Fleet', short: 'Flt', icon: '✈️' },
  { id: 'market', label: 'Hangar', short: 'Buy', icon: '🛒' },
  { id: 'fuel', label: 'Fuel', short: 'Fuel', icon: '⛽' },
  { id: 'routes', label: 'Routes', short: 'Rte', icon: '🛫' },
  { id: 'company', label: 'Airline', short: 'Co', icon: '💼' },
  { id: 'bank', label: 'Bank', short: 'Bank', icon: '🏦' },
  { id: 'finance', label: 'Books', short: '$$$', icon: '📊' },
]

/** Always on the mobile dock (order matters). */
const MOBILE_PRIMARY: AppTab[] = [
  'dashboard',
  'map',
  'fleet',
  'routes',
  'market',
]

const MOBILE_MORE: AppTab[] = [
  'hub',
  'fuel',
  'company',
  'bank',
  'finance',
]

type SidebarProps = {
  activeTab: AppTab
  onChange: (tab: AppTab) => void
}

export function Sidebar({ activeTab, onChange }: SidebarProps) {
  const [moreOpen, setMoreOpen] = useState(false)
  const moreActive = MOBILE_MORE.includes(activeTab)

  // Close sheet when leaving a "more" tab for a primary one
  useEffect(() => {
    if (!moreActive) setMoreOpen(false)
  }, [activeTab, moreActive])

  function select(tab: AppTab) {
    onChange(tab)
    setMoreOpen(false)
  }

  return (
    <>
      {/* Desktop left rail */}
      <nav
        className="game-nav hidden w-[4.75rem] flex-col gap-1 overflow-y-auto border-r p-1.5 py-2 sm:flex"
        aria-label="Main"
      >
        {TABS.map((tab) => {
          const active = tab.id === activeTab
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChange(tab.id)}
              title={tab.label}
              className={[
                'game-nav-btn w-full',
                active ? 'game-nav-btn-active' : '',
              ].join(' ')}
            >
              <span className="game-nav-icon" aria-hidden>
                {tab.icon}
              </span>
              <span className="game-nav-label">{tab.label}</span>
            </button>
          )
        })}
      </nav>

      {/* Mobile “More” sheet */}
      {moreOpen && (
        <div className="fixed inset-0 z-50 sm:hidden" role="dialog" aria-modal>
          <button
            type="button"
            className="absolute inset-0 bg-black/55"
            aria-label="Close menu"
            onClick={() => setMoreOpen(false)}
          />
          <div
            className="absolute inset-x-0 bottom-0 rounded-t-2xl border-t border-[rgba(196,163,90,0.25)] bg-[#1a1714] px-3 pb-4 pt-2 shadow-2xl"
            style={{
              paddingBottom: 'max(1rem, env(safe-area-inset-bottom))',
            }}
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-[rgba(160,145,120,0.35)]" />
            <p className="mb-2 text-center text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--game-dim)]">
              More
            </p>
            <div className="grid grid-cols-3 gap-2">
              {MOBILE_MORE.map((id) => {
                const tab = TABS.find((t) => t.id === id)!
                const active = tab.id === activeTab
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => select(tab.id)}
                    className={[
                      'flex min-h-[4.25rem] flex-col items-center justify-center gap-1 rounded-xl border px-2 py-2 transition',
                      active
                        ? 'border-[rgba(196,163,90,0.5)] bg-[rgba(196,163,90,0.14)] text-[var(--game-brass-hi)]'
                        : 'border-[rgba(160,145,120,0.15)] bg-black/20 text-[var(--game-muted)]',
                    ].join(' ')}
                  >
                    <span className="text-2xl" aria-hidden>
                      {tab.icon}
                    </span>
                    <span className="font-display text-xs font-semibold uppercase tracking-wide">
                      {tab.label}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Mobile bottom dock — 5 core + More */}
      <nav
        className="game-nav game-nav-mobile fixed inset-x-0 bottom-0 z-40 flex items-stretch gap-0.5 border-t px-1 pt-1 sm:hidden"
        style={{
          paddingBottom: 'max(0.35rem, env(safe-area-inset-bottom))',
          background: 'linear-gradient(180deg, #1a1714 0%, #12100e 100%)',
          boxShadow: '0 -4px 20px rgba(0,0,0,0.45)',
        }}
        aria-label="Main mobile"
      >
        {MOBILE_PRIMARY.map((id) => {
          const tab = TABS.find((t) => t.id === id)!
          const active = tab.id === activeTab
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => select(tab.id)}
              title={tab.label}
              className={[
                'game-nav-btn min-h-[3.15rem] min-w-0 flex-1 !py-1',
                active ? 'game-nav-btn-active' : '',
              ].join(' ')}
            >
              <span className="game-nav-icon text-lg" aria-hidden>
                {tab.icon}
              </span>
              <span className="game-nav-label !text-[10px]">{tab.short}</span>
            </button>
          )
        })}
        <button
          type="button"
          onClick={() => setMoreOpen((v) => !v)}
          title="More"
          className={[
            'game-nav-btn min-h-[3.15rem] min-w-0 flex-1 !py-1',
            moreActive || moreOpen ? 'game-nav-btn-active' : '',
          ].join(' ')}
        >
          <span className="game-nav-icon text-lg" aria-hidden>
            {moreActive
              ? TABS.find((t) => t.id === activeTab)?.icon ?? '···'
              : '···'}
          </span>
          <span className="game-nav-label !text-[10px]">
            {moreActive
              ? TABS.find((t) => t.id === activeTab)?.short ?? 'More'
              : 'More'}
          </span>
        </button>
      </nav>
    </>
  )
}
