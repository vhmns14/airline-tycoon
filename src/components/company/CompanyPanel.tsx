/**
 * Company HQ: branding, hub, staff, alliance, rivals, events, orders.
 */

import { useRef, useState } from 'react'
import { airports } from '../../data/airports'
import { cargoCatalog, passengerCatalog } from '../../data/aircraft'
import { AircraftThumb } from '../ui/AircraftThumb'
import { formatMoney, formatNumber } from '../../lib/format'
import { exportSaveDownload, importSaveFromFile } from '../../lib/saveIo'
import { formatDurationHm } from '../../lib/time'
import { ACHIEVEMENT_DEFS } from '../../sim/achievements'
import { estimateCompanyValue, INSURANCE_DAILY } from '../../sim/ceo'
import { CONTRACT_OFFERS } from '../../sim/contracts'
import { densityInfo } from '../../sim/cabin'
import { hangarExpandCost } from '../../sim/difficulty'
import { MARKETING_TIERS } from '../../sim/marketing'
import {
  requiredCabinCrew,
  requiredPilots,
  staffCoverage,
  staffDailyCost,
} from '../../sim/staff'
import { ORDER_DELIVERY_MS, useGameStore } from '../../store/gameStore'
import { TIME_SCALE_OPTIONS } from '../../sim/timeScale'
import { seasonComplete, seasonReward, rankScores } from '../../sim/season'
import { airports as airportList } from '../../data/airports'
import type { CabinDensity, TimeScale } from '../../types'

export function CompanyPanel() {
  const branding = useGameStore((s) => s.branding)
  const hubId = useGameStore((s) => s.hubId)
  const reputation = useGameStore((s) => s.reputation)
  const allianceId = useGameStore((s) => s.allianceId)
  const pilots = useGameStore((s) => s.pilots)
  const cabinCrew = useGameStore((s) => s.cabinCrew)
  const fleet = useGameStore((s) => s.ownedAircraft)
  const pendingOrders = useGameStore((s) => s.pendingOrders)
  const rivals = useGameStore((s) => s.rivals)
  const activeEvent = useGameStore((s) => s.activeEvent)
  const cash = useGameStore((s) => s.cash)
  const secondaryBases = useGameStore((s) => s.secondaryBases)
  const marketingUntil = useGameStore((s) => s.marketingUntil)
  const marketingLevel = useGameStore((s) => s.marketingLevel)
  const insuranceOn = useGameStore((s) => s.insuranceOn)
  const insuranceClaims = useGameStore((s) => s.insuranceClaims)
  const contracts = useGameStore((s) => s.contracts)
  const investorStake = useGameStore((s) => s.investorStake)
  const isPublic = useGameStore((s) => s.isPublic)
  const crewTraining = useGameStore((s) => s.crewTraining)
  const hangarSlots = useGameStore((s) => s.hangarSlots)
  const difficulty = useGameStore((s) => s.difficulty)
  const achievements = useGameStore((s) => s.achievements)
  const soundEnabled = useGameStore((s) => s.soundEnabled)
  const timeScale = useGameStore((s) => s.timeScale)
  const weeklyReport = useGameStore((s) => s.weeklyReport)
  const flightLog = useGameStore((s) => s.flightLog)
  const routes = useGameStore((s) => s.routes)
  const seasonGoal = useGameStore((s) => s.seasonGoal)
  const localScores = useGameStore((s) => s.localScores)
  const mapCargoOffers = useGameStore((s) => s.mapCargoOffers)
  const allianceLevel = useGameStore((s) => s.allianceLevel)

  const updateBranding = useGameStore((s) => s.updateBranding)
  const hirePilots = useGameStore((s) => s.hirePilots)
  const hireCabinCrew = useGameStore((s) => s.hireCabinCrew)
  const firePilots = useGameStore((s) => s.firePilots)
  const fireCabinCrew = useGameStore((s) => s.fireCabinCrew)
  const joinAlliance = useGameStore((s) => s.joinAlliance)
  const leaveAlliance = useGameStore((s) => s.leaveAlliance)
  const orderAircraft = useGameStore((s) => s.orderAircraft)
  const setCabinDensity = useGameStore((s) => s.setCabinDensity)
  const expandHangar = useGameStore((s) => s.expandHangar)
  const runMarketing = useGameStore((s) => s.runMarketing)
  const setInsurance = useGameStore((s) => s.setInsurance)
  const claimInsurance = useGameStore((s) => s.claimInsurance)
  const signContract = useGameStore((s) => s.signContract)
  const raiseInvestorCapital = useGameStore((s) => s.raiseInvestorCapital)
  const goPublic = useGameStore((s) => s.goPublic)
  const trainCrew = useGameStore((s) => s.trainCrew)
  const toggleSound = useGameStore((s) => s.toggleSound)
  const setTimeScale = useGameStore((s) => s.setTimeScale)
  const claimSeasonReward = useGameStore((s) => s.claimSeasonReward)
  const acceptMapCargo = useGameStore((s) => s.acceptMapCargo)
  const upgradeAlliance = useGameStore((s) => s.upgradeAlliance)
  const fileRef = useRef<HTMLInputElement>(null)

  const [name, setName] = useState(branding.name)
  const [raiseAmt, setRaiseAmt] = useState('500000')
  const [msg, setMsg] = useState<string | null>(null)

  const needP = requiredPilots(fleet)
  const needC = requiredCabinCrew(fleet)
  const cov = staffCoverage(pilots, cabinCrew, fleet)
  const hubAp = airports.find((a) => a.id === hubId)

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <div className="col-span-full flex flex-wrap items-center gap-3">
        <span
          className="flex h-11 w-11 items-center justify-center rounded-lg text-xl"
          style={{ background: branding.primaryColor }}
        >
          {branding.logoEmoji}
        </span>
        <div>
          <h2 className="screen-title">
            {branding.name}
          </h2>
          <p className="text-sm italic text-[var(--game-muted)]">
            {branding.slogan}
          </p>
          <p className="text-sm text-[var(--game-dim)]">
            Hub {hubAp?.code ?? '—'} · rep {reputation.toFixed(0)}
            {allianceId ? ' · Alliance' : ''}
            {isPublic ? ' · Public' : ''} · {difficulty}
          </p>
        </div>
      </div>

      {activeEvent && activeEvent.endsAt > Date.now() && (
        <div className="col-span-full rounded-lg border border-[rgba(196,122,74,0.4)] bg-[rgba(196,122,74,0.1)] px-3 py-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--game-warn)]">
            Event · {formatDurationHm(activeEvent.endsAt - Date.now())}
          </p>
          <p className="text-sm font-semibold">{activeEvent.title}</p>
          <p className="text-sm text-[var(--game-muted)]">
            {activeEvent.description}
          </p>
        </div>
      )}

      {msg && (
        <p className="col-span-full text-sm text-[var(--game-brass)]">{msg}</p>
      )}

      {/* Branding */}
      <Section title="Branding">
        <div className="flex flex-wrap gap-2">
          <input
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button
            type="button"
            className="rounded-lg bg-sky-600 px-3 py-2 text-sm font-semibold"
            onClick={() => {
              updateBranding({ name: name.trim() || branding.name })
              setMsg('Branding saved.')
            }}
          >
            Save name
          </button>
        </div>
      </Section>

      {/* Hub shortcut */}
      <Section title="Hub network">
        <p className="text-[11px] text-slate-400">
          HQ {hubAp?.code ?? '—'}
          {secondaryBases.length > 0
            ? ` · bases ${secondaryBases
                .map((id) => airports.find((a) => a.id === id)?.code ?? id)
                .join(', ')}`
            : ' · no secondary bases'}
        </p>
        <p className="mt-1 text-[10px] text-slate-600">
          Full control (relocate, open/close bases, facilities) →{' '}
          <strong className="text-slate-400">Hub</strong> tab.
        </p>
      </Section>

      {/* Staff */}
      <Section title="Staff & training">
        <p className="text-[11px] text-slate-400">
          Need {needP} pilots & {needC} cabin · payroll{' '}
          {formatMoney(staffDailyCost(pilots, cabinCrew))}/day · training L
          {crewTraining}/5
          {cov.understaffed && (
            <span className="text-amber-300"> · understaffed</span>
          )}
        </p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <StaffBox
            label="Pilots"
            value={pilots}
            need={needP}
            onHire={() => setMsg(hirePilots(1) ? 'Hired pilot.' : 'Need cash.')}
            onFire={() => firePilots(1)}
          />
          <StaffBox
            label="Cabin crew"
            value={cabinCrew}
            need={needC}
            onHire={() =>
              setMsg(hireCabinCrew(1) ? 'Hired crew.' : 'Need cash.')
            }
            onFire={() => fireCabinCrew(1)}
          />
        </div>
        <button
          type="button"
          className="mt-2 rounded-md bg-sky-700 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-sky-600"
          onClick={() =>
            setMsg(trainCrew() ? 'Crew trained (+demand).' : 'Max or no cash.')
          }
        >
          Train crew (+3% ops quality)
        </button>
      </Section>

      {/* Hangar */}
      <Section title="Hangar capacity">
        <p className="text-[11px] text-slate-400">
          {fleet.length}/{hangarSlots} slots used
          {pendingOrders.length > 0
            ? ` · ${pendingOrders.length} on order`
            : ''}
        </p>
        <button
          type="button"
          className="mt-1.5 rounded-md bg-sky-700 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-sky-600"
          onClick={() =>
            setMsg(
              expandHangar()
                ? 'Hangar expanded (+2).'
                : `Need ${formatMoney(hangarExpandCost(hangarSlots))}.`,
            )
          }
        >
          Expand +2 · {formatMoney(hangarExpandCost(hangarSlots))}
        </button>
      </Section>

      {/* Marketing */}
      <Section title="Marketing">
        <p className="text-[10px] text-slate-500">
          {marketingUntil > Date.now()
            ? `Campaign L${marketingLevel} active · ${formatDurationHm(marketingUntil - Date.now())} left`
            : 'No campaign — demand at baseline.'}
        </p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {MARKETING_TIERS.map((t) => (
            <button
              key={t.level}
              type="button"
              className="rounded border border-pink-500/30 bg-pink-500/10 px-2 py-1 text-[10px] font-semibold text-pink-200 hover:bg-pink-500/20"
              onClick={() =>
                setMsg(
                  runMarketing(t.level)
                    ? `${t.label} live!`
                    : 'Need cash for ads.',
                )
              }
            >
              {t.label} · {formatMoney(t.cost)}
            </button>
          ))}
        </div>
      </Section>

      {/* Insurance */}
      <Section title="Insurance">
        <label className="flex items-center gap-2 text-xs text-slate-300">
          <input
            type="checkbox"
            checked={insuranceOn}
            onChange={(e) => setInsurance(e.target.checked)}
          />
          Hull insurance · {formatMoney(INSURANCE_DAILY)}/day · softens weather
          fines
        </label>
        {insuranceClaims.filter((c) => !c.claimed).length > 0 && (
          <ul className="mt-2 space-y-1">
            {insuranceClaims
              .filter((c) => !c.claimed)
              .map((c) => (
                <li
                  key={c.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[11px]"
                >
                  <span>
                    {c.reason} · {formatMoney(c.amount)}
                  </span>
                  <button
                    type="button"
                    className="rounded bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white"
                    onClick={() =>
                      setMsg(
                        claimInsurance(c.id)
                          ? 'Claim paid.'
                          : 'Claim failed.',
                      )
                    }
                  >
                    File claim
                  </button>
                </li>
              ))}
          </ul>
        )}
      </Section>

      {/* Contracts */}
      <Section title="Charter contracts">
        <ul className="space-y-1 text-[11px]">
          {CONTRACT_OFFERS.map((o, i) => (
            <li
              key={o.label}
              className="flex flex-wrap items-center justify-between gap-2 rounded border border-slate-800 bg-slate-950/40 px-2 py-1"
            >
              <span>
                {o.label} · {formatMoney(o.payoutPerDay)}/d · {o.days}d
                {reputation < o.unlockRep && (
                  <span className="text-amber-400"> · rep≥{o.unlockRep}</span>
                )}
              </span>
              <button
                type="button"
                className="rounded bg-sky-700 px-2 py-0.5 text-[10px] font-bold text-white"
                onClick={() =>
                  setMsg(
                    signContract(i)
                      ? 'Contract signed.'
                      : 'Locked / max 3 contracts.',
                  )
                }
              >
                Sign
              </button>
            </li>
          ))}
        </ul>
        {contracts.length > 0 && (
          <p className="mt-1 text-[10px] text-emerald-400/90">
            Active: {contracts.map((c) => c.label).join(' · ')}
          </p>
        )}
      </Section>

      {/* Investors / IPO */}
      <Section title="Investors & IPO">
        <p className="text-[10px] text-slate-500">
          Equity sold: {investorStake.toFixed(1)}% · co. value ~
          {formatMoney(estimateCompanyValue(cash, fleet, reputation))}
          {isPublic ? ' · listed public company' : ' · private'} · dividends on
          profitable tax periods
        </p>
        {!isPublic && (
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <input
              type="number"
              className="w-28 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs"
              value={raiseAmt}
              onChange={(e) => setRaiseAmt(e.target.value)}
            />
            <button
              type="button"
              className="rounded bg-violet-700 px-2 py-1 text-[11px] font-bold text-white"
              onClick={() =>
                setMsg(
                  raiseInvestorCapital(Number(raiseAmt))
                    ? 'Capital raised.'
                    : 'Min $100k or equity cap 35%.',
                )
              }
            >
              Raise capital
            </button>
            <button
              type="button"
              className="rounded bg-amber-600 px-2 py-1 text-[11px] font-bold text-white hover:bg-amber-500"
              title="Need rep≥55, 3+ routes, solid cash"
              onClick={() =>
                setMsg(
                  goPublic()
                    ? 'IPO complete — you are public!'
                    : 'IPO locked: rep≥55, 3+ routes, peak~$1.5M or cash~$800k.',
                )
              }
            >
              Go public (IPO)
            </button>
          </div>
        )}
        {isPublic && (
          <p className="mt-1 text-[11px] text-amber-200/90">
            Public company — equity markets open; dividends continue.
          </p>
        )}
      </Section>

      {/* Weekly report */}
      <Section title="Weekly report">
        <div className="grid grid-cols-2 gap-1.5 text-[11px] sm:grid-cols-3">
          <MiniStat label="Week" value={weeklyReport.weekKey || '—'} />
          <MiniStat
            label="Revenue"
            value={formatMoney(weeklyReport.revenue)}
          />
          <MiniStat label="Costs" value={formatMoney(weeklyReport.costs)} />
          <MiniStat label="Legs" value={formatNumber(weeklyReport.legs)} />
          <MiniStat
            label="Delayed"
            value={formatNumber(weeklyReport.delayedLegs)}
          />
          <MiniStat
            label="Fuel burn"
            value={`${formatNumber(Math.round(weeklyReport.fuelBurned))} L`}
          />
        </div>
      </Section>

      {/* Flight log */}
      <Section title="Flight log (recent)">
        {flightLog.length === 0 ? (
          <p className="text-[11px] text-slate-500">No completed legs yet.</p>
        ) : (
          <ul className="max-h-40 space-y-0.5 overflow-auto text-[10px]">
            {flightLog.slice(0, 20).map((e) => {
              const from = airports.find((a) => a.id === e.fromId)
              const to = airports.find((a) => a.id === e.toId)
              return (
                <li
                  key={e.id}
                  className="flex flex-wrap justify-between gap-1 border-b border-slate-800/60 py-0.5 text-slate-400"
                >
                  <span>
                    <span className="font-mono text-sky-300/90">
                      {e.flightNumber}
                    </span>{' '}
                    {from?.code ?? '?'}→{to?.code ?? '?'} · {e.model}
                    {e.delayed ? (
                      <span className="text-amber-400"> · delay</span>
                    ) : null}
                  </span>
                  <span
                    className={
                      e.profit >= 0 ? 'text-emerald-400' : 'text-red-400'
                    }
                  >
                    {formatMoney(e.profit)}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </Section>

      {/* Achievements */}
      <Section title="Achievements">
        <ul className="grid gap-1 sm:grid-cols-2">
          {ACHIEVEMENT_DEFS.map((a) => {
            const unlocked = achievements.includes(a.id)
            return (
              <li
                key={a.id}
                className={[
                  'rounded border px-2 py-1 text-[11px]',
                  unlocked
                    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-100'
                    : 'border-slate-800 bg-slate-950/40 text-slate-500',
                ].join(' ')}
              >
                <span className="font-semibold">
                  {unlocked ? '✓ ' : '○ '}
                  {a.title}
                </span>
                <span className="mt-0.5 block text-[10px] opacity-80">
                  {a.hint}
                </span>
              </li>
            )
          })}
        </ul>
      </Section>

      {/* Season + scores */}
      <Section title="Season goal">
        <p className="text-sm text-[var(--game-muted)]">
          Week {seasonGoal?.weekKey ?? '—'} · legs {seasonGoal?.legs ?? 0}/
          {seasonGoal?.targetLegs ?? 12} · rev{' '}
          {formatMoney(seasonGoal?.revenue ?? 0)} /{' '}
          {formatMoney(seasonGoal?.targetRevenue ?? 80_000)}
        </p>
        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-black/40">
          <div
            className="h-full rounded-full bg-[var(--game-olive)]"
            style={{
              width: `${Math.min(
                100,
                (((seasonGoal?.legs ?? 0) / (seasonGoal?.targetLegs || 1) +
                  (seasonGoal?.revenue ?? 0) /
                    (seasonGoal?.targetRevenue || 1)) /
                  2) *
                  100,
              )}%`,
            }}
          />
        </div>
        <button
          type="button"
          className="btn-game btn-game-success mt-2 !text-xs"
          disabled={!seasonGoal || seasonGoal.claimed || !seasonComplete(seasonGoal)}
          onClick={() =>
            setMsg(
              claimSeasonReward()
                ? `Reward +${formatMoney(seasonReward(seasonGoal!))}`
                : 'Not complete or already claimed.',
            )
          }
        >
          {seasonGoal?.claimed
            ? 'Claimed'
            : `Claim reward${
                seasonGoal ? ` · ${formatMoney(seasonReward(seasonGoal))}` : ''
              }`}
        </button>
        {localScores.length > 0 && (
          <ul className="mt-2 space-y-0.5 text-xs text-[var(--game-dim)]">
            {rankScores(localScores, seasonGoal?.weekKey ?? '').map((s, i) => (
              <li key={`${s.at}-${i}`}>
                #{i + 1} {s.name} · {s.score.toLocaleString()}
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* Map cargo offers — full board also lives under Map tab */}
      <Section title="Map cargo jobs">
        <p className="mb-1.5 text-xs text-[var(--game-dim)]">
          Accept · open freighter route A→B · Fly · orange lane on Map
        </p>
        <ul className="space-y-1.5">
          {mapCargoOffers.slice(0, 5).map((o) => {
            const from = airportList.find((a) => a.id === o.fromId)
            const to = airportList.find((a) => a.id === o.toId)
            const tons = o.cargoTons ?? 0
            const canLift = fleet.some(
              (p) => p.role === 'cargo' && (p.capacity ?? 0) >= tons,
            )
            return (
              <li
                key={o.id}
                className="flex flex-col gap-1.5 rounded-md border border-[rgba(160,145,120,0.15)] bg-black/15 px-2 py-1.5 text-sm sm:flex-row sm:flex-wrap sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <span className="font-semibold">
                    {from?.code ?? '?'}→{to?.code ?? '?'}
                  </span>
                  <span className="text-[var(--game-muted)]">
                    {' '}
                    · {tons}t ·{' '}
                  </span>
                  <span className="text-[var(--game-cash)]">
                    {formatMoney(o.deliveryPayout ?? 0)}
                  </span>
                  <p className="text-[10px] text-[var(--game-dim)]">
                    {from?.city ?? '?'} → {to?.city ?? '?'}
                    {canLift
                      ? ' · freighter ready'
                      : ` · need freighter ≥${tons}t`}
                  </p>
                </div>
                <button
                  type="button"
                  className="btn-game btn-game-primary !min-h-[2.5rem] !py-1 !text-xs"
                  onClick={() =>
                    setMsg(
                      acceptMapCargo(o.id)
                        ? 'Job accepted — open Map filter Cargo or Routes to fly A→B.'
                        : 'Max jobs or invalid.',
                    )
                  }
                >
                  Accept
                </button>
              </li>
            )
          })}
          {mapCargoOffers.length === 0 && (
            <li className="text-xs text-[var(--game-dim)]">No offers right now…</li>
          )}
        </ul>
        {contracts.filter((c) => c.kind === 'map_cargo').length > 0 && (
          <ul className="mt-2 space-y-1">
            {contracts
              .filter((c) => c.kind === 'map_cargo' && !c.delivered)
              .map((c) => {
                const from = airportList.find((a) => a.id === c.fromId)
                const to = airportList.find((a) => a.id === c.toId)
                return (
                  <li
                    key={c.id}
                    className="rounded border border-orange-500/30 bg-orange-950/15 px-2 py-1 text-[11px] text-orange-100/90"
                  >
                    Active {from?.code ?? '?'}→{to?.code ?? '?'} ·{' '}
                    {c.cargoTons ?? 0}t · {formatMoney(c.deliveryPayout ?? 0)}
                  </li>
                )
              })}
          </ul>
        )}
      </Section>

      {/* Settings / save */}
      <Section title="Settings & save">
        <p className="mb-1.5 text-xs text-[var(--game-dim)]">Flight time scale</p>
        <div className="mb-2 flex flex-wrap gap-1.5">
          {TIME_SCALE_OPTIONS.map((o) => (
            <button
              key={o.id}
              type="button"
              title={o.blurb}
              onClick={() => setTimeScale(o.id as TimeScale)}
              className={[
                'btn-game !text-xs',
                timeScale === o.id ? 'btn-game-primary' : 'btn-game-ghost',
              ].join(' ')}
            >
              {o.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            className="btn-game btn-game-ghost !text-xs"
            onClick={() => toggleSound()}
          >
            Sound: {soundEnabled ? 'On' : 'Off'}
          </button>
          <button
            type="button"
            className="rounded border border-sky-500/40 px-2 py-1 text-[11px] font-semibold text-sky-300"
            onClick={() => {
              exportSaveDownload()
              setMsg('Save exported.')
            }}
          >
            Export save
          </button>
          <button
            type="button"
            className="rounded border border-violet-500/40 px-2 py-1 text-[11px] font-semibold text-violet-300"
            onClick={() => fileRef.current?.click()}
          >
            Import save
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0]
              if (!f) return
              const err = await importSaveFromFile(f)
              setMsg(err ?? 'Save imported.')
              e.target.value = ''
            }}
          />
        </div>
        <p className="mt-1 text-[10px] text-slate-600">
          {routes.length} routes · hangar {fleet.length}/{hangarSlots}
        </p>
      </Section>

      {/* Alliance */}
      <Section title="Alliance & codeshare">
        {allianceId ? (
          <div className="space-y-2">
            <p className="text-sm text-[var(--game-cash)]">
              SkyLink L{allianceLevel || 1} · +
              {(allianceLevel ?? 1) >= 2 ? '14' : '8'}% demand
              {(allianceLevel ?? 1) >= 2 ? ' · slot discount' : ''}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {(allianceLevel ?? 1) < 2 && (
                <button
                  type="button"
                  className="btn-game btn-game-primary !text-xs"
                  onClick={() =>
                    setMsg(
                      upgradeAlliance()
                        ? 'Codeshare upgraded to L2.'
                        : 'Need $120k + rep≥60.',
                    )
                  }
                >
                  Upgrade codeshare · $120k
                </button>
              )}
              <button
                type="button"
                className="btn-game btn-game-ghost !text-xs"
                onClick={() => leaveAlliance()}
              >
                Leave
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            className="btn-game btn-game-primary"
            onClick={() =>
              setMsg(
                joinAlliance()
                  ? 'Joined SkyLink Alliance.'
                  : `Need ${formatMoney(50_000)}.`,
              )
            }
          >
            Join SkyLink — $50,000
          </button>
        )}
      </Section>

      {/* Cabin configs */}
      <Section title="Cabin density (parked passenger aircraft)">
        <ul className="space-y-2">
          {fleet
            .filter((p) => p.role === 'passenger')
            .map((p) => (
              <li
                key={p.instanceId}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-800 bg-slate-950/50 px-3 py-2 text-sm"
              >
                <span>
                  {p.model}{' '}
                  <span className="text-slate-500">
                    ({p.cabin?.economy ?? 0}Y / {p.cabin?.business ?? 0}J /{' '}
                    {p.cabin?.first ?? 0}F) · {densityInfo(p.cabin?.density ?? 'standard').label}
                  </span>
                </span>
                <select
                  className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-xs"
                  value={p.cabin?.density ?? 'standard'}
                  disabled={p.flight?.status === 'IN_FLIGHT'}
                  onChange={(e) => {
                    const ok = setCabinDensity(
                      p.instanceId,
                      e.target.value as CabinDensity,
                    )
                    setMsg(ok ? 'Cabin updated.' : 'Park the aircraft first.')
                  }}
                >
                  <option value="dense">Dense (+seats, −range)</option>
                  <option value="standard">Standard</option>
                  <option value="comfort">Comfort (−seats, +range)</option>
                </select>
              </li>
            ))}
          {fleet.filter((p) => p.role === 'passenger').length === 0 && (
            <p className="text-sm text-slate-500">No passenger aircraft yet.</p>
          )}
        </ul>
      </Section>

      {/* Orders */}
      <Section title={`Factory orders (delivery ~${ORDER_DELIVERY_MS / 60000} min real)`}>
        <p className="mb-2 text-xs text-slate-500">
          Pay 30% deposit now, balance on delivery. Cash on hand:{' '}
          {formatMoney(cash)}.
        </p>
        <div className="grid max-h-64 gap-1.5 overflow-auto sm:grid-cols-2">
          {[...passengerCatalog(), ...cargoCatalog()].map((a) => (
            <button
              key={a.id}
              type="button"
              className="flex items-center gap-2 rounded-md border border-slate-700 bg-slate-950/60 px-2 py-1.5 text-left text-xs hover:border-sky-500/40"
              onClick={() =>
                setMsg(
                  orderAircraft(a.id)
                    ? `Ordered ${a.model}.`
                    : 'Need deposit cash.',
                )
              }
            >
              <AircraftThumb plane={a} size="sm" />
              <span className="min-w-0">
                <span className="block font-semibold">{a.model}</span>
                <span className="block text-[10px] text-slate-500">
                  {a.manufacturer} · Deposit{' '}
                  {formatMoney(Math.round(a.price * 0.3))}
                </span>
              </span>
            </button>
          ))}
        </div>
        {pendingOrders.length > 0 && (
          <ul className="mt-3 space-y-1 text-sm text-slate-400">
            {pendingOrders.map((o) => (
              <li key={o.id}>
                📦 {o.model} — arrives in{' '}
                {formatDurationHm(Math.max(0, o.deliverAt - Date.now()))}
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* Rivals */}
      <Section title="Rival airlines">
        <ul className="space-y-2">
          {rivals.map((r) => (
            <li
              key={r.id}
              className="rounded-xl border border-slate-800 bg-slate-950/50 px-3 py-2 text-sm"
            >
              <span className="mr-2 text-lg">{r.logoEmoji}</span>
              <span className="font-semibold text-slate-200">{r.name}</span>
              <span className="ml-2 text-xs text-slate-500">
                {r.routes.length} competing OD pairs (−8% demand each)
              </span>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  )
}

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="game-panel">
      <header className="game-panel-header">
        <h3 className="game-panel-title">{title}</h3>
      </header>
      <div className="game-panel-body">{children}</div>
    </section>
  )
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-slate-800 bg-slate-950/50 px-2 py-1">
      <p className="text-[9px] uppercase tracking-wider text-slate-600">
        {label}
      </p>
      <p className="font-mono text-[11px] font-semibold text-slate-200">
        {value}
      </p>
    </div>
  )
}

function StaffBox({
  label,
  value,
  need,
  onHire,
  onFire,
}: {
  label: string
  value: number
  need: number
  onHire: () => void
  onFire: () => void
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-xl font-bold tabular-nums">
        {formatNumber(value)}{' '}
        <span className="text-sm font-normal text-slate-500">/ {need}</span>
      </p>
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={onHire}
          className="rounded-lg bg-sky-600 px-2 py-1 text-xs font-semibold"
        >
          + Hire
        </button>
        <button
          type="button"
          onClick={onFire}
          className="rounded-lg border border-slate-600 px-2 py-1 text-xs"
        >
          − Fire
        </button>
      </div>
    </div>
  )
}
