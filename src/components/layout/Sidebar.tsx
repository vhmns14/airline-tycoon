/**
 * Game-style icon navigation — rail on desktop, bottom dock on mobile.
 * Mobile: 5 primary tabs + “More” sheet for the rest.
 * Admin is pinned (not buried under scroll).
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
  | 'admin'

const MAIN_TABS: { id: AppTab; label: string; short: string; icon: string }[] = [
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

const ADMIN_TAB = {
  id: 'admin' as const,
  label: 'Admin',
  short: 'Adm',
  icon: '🛡',
}

/** Always on the mobile dock (order matters). */
const MOBILE_PRIMARY: AppTab[] = [
  'dashboard',
  'map',
  'fleet',
  'routes',
  'market',
]

const MOBILE_MORE_BASE: AppTab[] = [
  'hub',
  'fuel',
  'company',
  'bank',
  'finance',
]

type SidebarProps = {
  activeTab: AppTab
  onChange: (tab: AppTab) => void
  /** Show Admin tab (server-side isAdmin). */
  showAdmin?: boolean
}

export function Sidebar({
  activeTab,
  onChange,
  showAdmin = false,
}: SidebarProps) {
  const [moreOpen, setMoreOpen] = useState(false)
  // Admin first in More so it is not buried
  const MOBILE_MORE = showAdmin
    ? (['admin', ...MOBILE_MORE_BASE] as AppTab[])
    : MOBILE_MORE_BASE
  const moreActive = MOBILE_MORE.includes(activeTab)

  useEffect(() => {
    if (!moreActive) setMoreOpen(false)
  }, [activeTab, moreActive])

  function select(tab: AppTab) {
    onChange(tab)
    setMoreOpen(false)
  }

  function tabMeta(id: AppTab) {
    if (id === 'admin') return ADMIN_TAB
    return MAIN_TABS.find((t) => t.id === id)!
  }

  return (
    <>
      {/* Desktop left rail — main scroll + admin pinned on top */}
      <nav
        className="game-nav relative z-20 hidden w-[4.75rem] shrink-0 flex-col border-r sm:flex"
        aria-label="Main"
      >
        {showAdmin && (
          <div className="shrink-0 border-b border-[rgba(196,163,90,0.25)] p-1.5 pt-2">
            <button
              type="button"
              onClick={() => onChange('admin')}
              title="Admin — players"
              className={[
                'game-nav-btn w-full',
                activeTab === 'admin' ? 'game-nav-btn-active' : '',
                'ring-1 ring-[rgba(196,163,90,0.2)]',
              ].join(' ')}
            >
              <span className="game-nav-icon" aria-hidden>
                {ADMIN_TAB.icon}
              </span>
              <span className="game-nav-label">{ADMIN_TAB.label}</span>
            </button>
          </div>
        )}
        <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto p-1.5 py-2">
          {MAIN_TABS.map((tab) => {
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
        </div>
      </nav>

      {/* Mobile “More” sheet */}
      {moreOpen && (
        <div className="fixed inset-0 z-[60] sm:hidden" role="dialog" aria-modal>
          <button
            type="button"
            className="absolute inset-0 bg-black/55"
            aria-label="Close menu"
            onClick={() => setMoreOpen(false)}
          />
          <div
            className="absolute inset-x-0 bottom-0 z-[61] rounded-t-2xl border-t border-[rgba(196,163,90,0.25)] bg-[#1a1714] px-3 pb-4 pt-2 shadow-2xl"
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
                const tab = tabMeta(id)
                const active = tab.id === activeTab
                const isAdminBtn = tab.id === 'admin'
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => select(tab.id)}
                    className={[
                      'flex min-h-[4.25rem] flex-col items-center justify-center gap-1 rounded-xl border px-2 py-2 transition',
                      active
                        ? 'border-[rgba(196,163,90,0.5)] bg-[rgba(196,163,90,0.14)] text-[var(--game-brass-hi)]'
                        : isAdminBtn
                          ? 'border-[rgba(196,163,90,0.35)] bg-[rgba(196,163,90,0.08)] text-[var(--game-brass)]'
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
          const tab = tabMeta(id)
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
              ? tabMeta(activeTab).icon
              : '···'}
          </span>
          <span className="game-nav-label !text-[10px]">
            {moreActive ? tabMeta(activeTab).short : 'More'}
          </span>
        </button>
      </nav>
    </>
  )
}
