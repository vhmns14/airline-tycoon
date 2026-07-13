/**
 * App shell — exclusive setup screen, then game HUD + nav.
 */

import { useEffect, useState } from 'react'
import { startHangarAmbience, stopHangarAmbience } from './sim/sound'
import { AdminPanel } from './components/admin/AdminPanel'
import { CompanyPanel } from './components/company/CompanyPanel'
import { SetupModal } from './components/company/SetupModal'
import { Dashboard } from './components/dashboard/Dashboard'
import { BankPanel } from './components/bank/BankPanel'
import { FinancePanel } from './components/finance/FinancePanel'
import { FleetPanel } from './components/fleet/FleetPanel'
import { MarketPanel } from './components/market/MarketPanel'
import { FuelPanel } from './components/fuel/FuelPanel'
import { GameOverScreen } from './components/GameOverScreen'
import { HubPanel } from './components/hub/HubPanel'
import { MapPanel } from './components/map/MapPanel'
import { RoutesPanel } from './components/routes/RoutesPanel'
import { Sidebar, type AppTab } from './components/layout/Sidebar'
import { TopBar } from './components/layout/TopBar'
import { NotificationToasts } from './components/ui/NotificationToasts'
import { TutorialOverlay } from './components/ui/TutorialOverlay'
import { useCloudSync } from './hooks/useCloudSync'
import { useFlightTicker } from './sim/ticker'
import { useAuthStore } from './store/authStore'
import { useGameStore } from './store/gameStore'

export default function App() {
  const [tab, setTab] = useState<AppTab>('dashboard')
  const setupComplete = useGameStore((s) => s.setupComplete)
  const branding = useGameStore((s) => s.branding)
  const activeEvent = useGameStore((s) => s.activeEvent)
  const soundEnabled = useGameStore((s) => s.soundEnabled)
  const syncMessage = useAuthStore((s) => s.syncMessage)
  const syncStatus = useAuthStore((s) => s.syncStatus)
  const user = useAuthStore((s) => s.user)
  const isAdmin = !!user?.isAdmin

  useFlightTicker()
  useCloudSync()

  // New game → back to ops after re-founding
  useEffect(() => {
    if (!setupComplete) setTab('dashboard')
  }, [setupComplete])

  // Leave admin tab if session loses admin flag
  useEffect(() => {
    if (tab === 'admin' && !isAdmin) setTab('dashboard')
  }, [tab, isAdmin])

  // Soft hangar ambient when sound on
  useEffect(() => {
    if (setupComplete && soundEnabled) startHangarAmbience(true)
    else stopHangarAmbience()
    return () => stopHangarAmbience()
  }, [setupComplete, soundEnabled])

  const accent = branding.primaryColor

  // Exclusive founding screen — no HUD leak underneath
  if (!setupComplete) {
    return (
      <div
        className="game-shell text-slate-100"
        style={
          {
            ['--accent' as string]: accent,
          } as React.CSSProperties
        }
      >
        <div className="main-scroll min-h-0 flex-1">
          <SetupModal />
        </div>
      </div>
    )
  }

  return (
    <div
      className="game-shell text-slate-100"
      style={
        {
          ['--accent' as string]: accent,
        } as React.CSSProperties
      }
    >
      <TopBar onOpenAdmin={() => setTab('admin')} />

      {user && syncMessage && (
        <div
          className={[
            'shrink-0 border-b px-3 py-1 text-center text-[10px] font-semibold uppercase tracking-wider',
            syncStatus === 'error'
              ? 'border-red-500/30 bg-red-950/60 text-red-200'
              : syncStatus === 'saving' || syncStatus === 'loading'
                ? 'border-amber-500/25 bg-amber-950/40 text-amber-100'
                : 'border-emerald-500/25 bg-emerald-950/40 text-emerald-200',
          ].join(' ')}
        >
          {syncMessage}
        </div>
      )}

      {activeEvent && activeEvent.endsAt > Date.now() && (
        <div className="relative shrink-0 overflow-hidden border-b border-amber-400/30 bg-gradient-to-r from-amber-950/80 via-orange-950/50 to-amber-950/80 px-3 py-1.5 text-center">
          <div className="pointer-events-none absolute inset-0 animate-pulse bg-amber-400/5" />
          <p className="relative text-[11px] font-semibold text-amber-100">
            <span className="mr-1.5 inline-block animate-bounce">⚠️</span>
            <span className="font-display tracking-wide text-amber-300">
              {activeEvent.title}
            </span>
            <span className="mx-1.5 text-amber-500/60">—</span>
            {activeEvent.description}
          </p>
        </div>
      )}

      <div className="flex min-h-0 min-w-0 flex-1 flex-col sm:flex-row">
        <Sidebar activeTab={tab} onChange={setTab} showAdmin={isAdmin} />
        <main className="main-scroll p-2 sm:p-3 sm:pb-4 lg:p-4">
          <div key={tab} className="mx-auto w-full max-w-[1600px] animate-fade-in">
            {tab === 'dashboard' && <Dashboard />}
            {tab === 'map' && <MapPanel />}
            {tab === 'hub' && <HubPanel />}
            {tab === 'fleet' && <FleetPanel />}
            {tab === 'market' && <MarketPanel />}
            {tab === 'fuel' && <FuelPanel />}
            {tab === 'routes' && <RoutesPanel />}
            {tab === 'company' && <CompanyPanel />}
            {tab === 'bank' && <BankPanel />}
            {tab === 'finance' && <FinancePanel />}
            {tab === 'admin' && <AdminPanel />}
          </div>
        </main>
      </div>

      <GameOverScreen />
      <TutorialOverlay />
      <NotificationToasts />
    </div>
  )
}
