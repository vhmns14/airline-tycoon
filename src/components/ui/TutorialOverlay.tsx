/**
 * Lightweight 5-step first-run tutorial.
 */

import { useGameStore } from '../../store/gameStore'

const STEPS = [
  {
    title: 'Welcome, CEO',
    body: 'Build an airline in real time. Cash, fuel, and flights update live.',
  },
  {
    title: '1 · Buy a plane',
    body: 'Market → pick a manufacturer (start with Cessna / Twin Otter) → Buy or Rent.',
  },
  {
    title: '2 · Fuel up',
    body: 'Fuel tab → buy avtur. Planes will not depart without stock.',
  },
  {
    title: '3 · Open a route',
    body: 'Routes → plane + destination → Open route. Plane parks at origin.',
  },
  {
    title: '4 · Click Fly',
    body: 'On Routes or Dashboard, press Fly to depart. On arrival it parks again until you Fly the return.',
  },
]

export function TutorialOverlay() {
  const done = useGameStore((s) => s.tutorialDone)
  const step = useGameStore((s) => s.tutorialStep)
  const advance = useGameStore((s) => s.advanceTutorial)
  const skip = useGameStore((s) => s.skipTutorial)
  const setupComplete = useGameStore((s) => s.setupComplete)

  if (!setupComplete || done || step >= STEPS.length) return null

  const s = STEPS[step] ?? STEPS[0]

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-sky-500/30 bg-slate-950/95 p-3 shadow-2xl backdrop-blur sm:inset-x-auto sm:bottom-4 sm:left-4 sm:max-w-sm sm:rounded-xl sm:border">
      <p className="text-[10px] font-bold uppercase tracking-wider text-sky-400">
        Tutorial {step + 1}/{STEPS.length}
      </p>
      <h3 className="mt-0.5 text-sm font-bold text-slate-100">{s.title}</h3>
      <p className="mt-1 text-[11px] leading-relaxed text-slate-400">{s.body}</p>
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={() => advance()}
          className="rounded-md bg-sky-600 px-3 py-1 text-[11px] font-bold text-white hover:bg-sky-500"
        >
          {step >= STEPS.length - 1 ? 'Got it' : 'Next'}
        </button>
        <button
          type="button"
          onClick={() => skip()}
          className="rounded-md px-2 py-1 text-[11px] text-slate-500 hover:text-slate-300"
        >
          Skip
        </button>
      </div>
    </div>
  )
}
