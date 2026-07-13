/**
 * Career missions card.
 */

import { evaluateGoals, goalsProgress } from '../../sim/goals'
import { useGameStore } from '../../store/gameStore'
import { GamePanel } from '../ui/GamePanel'

export function GoalsCard() {
  const state = useGameStore()
  const goals = evaluateGoals(state)
  const { done, total, next, allDone } = goalsProgress(goals)
  const pct = total ? (done / total) * 100 : 0

  return (
    <GamePanel
      title="Career missions"
      icon="🎯"
      className="h-full"
      right={
        <span className="font-display text-sm tabular-nums text-[var(--game-brass)]">
          {done}/{total}
        </span>
      }
    >
      <p className="text-sm text-[var(--game-muted)]">
        {allDone
          ? '🏆 All missions complete — legend CEO.'
          : next
            ? `Next: ${next.title}`
            : 'Milestones await.'}
      </p>

      <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-black/40">
        <div
          className="h-full rounded-full bg-[var(--game-olive)] transition-[width] duration-700"
          style={{ width: `${pct}%` }}
        />
      </div>

      <ul className="mt-3 flex flex-wrap gap-1.5">
        {goals.map((g) => (
          <li
            key={g.id}
            title={g.done ? g.title : `${g.title} — ${g.hint}`}
            className={[
              'rounded-md px-2 py-1 text-xs font-semibold uppercase tracking-wide transition',
              g.done
                ? 'border border-[rgba(143,173,122,0.4)] bg-[rgba(143,173,122,0.12)] text-[var(--game-cash)]'
                : 'border border-[rgba(160,145,120,0.2)] bg-black/20 text-[var(--game-dim)]',
            ].join(' ')}
          >
            {g.done ? '✓' : '○'} {g.badge}
          </li>
        ))}
      </ul>
    </GamePanel>
  )
}
