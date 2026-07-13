/**
 * Big dispatch control — fly every parked plane.
 */

import { useMemo } from 'react'
import { formatNumber } from '../../lib/format'
import { useGameStore } from '../../store/gameStore'

type FlyAllBarProps = {
  compact?: boolean
  className?: string
}

export function FlyAllBar({ compact = false, className = '' }: FlyAllBarProps) {
  const routes = useGameStore((s) => s.routes)
  const ownedAircraft = useGameStore((s) => s.ownedAircraft)
  const gameOver = useGameStore((s) => s.gameOver)
  const groundAll = useGameStore((s) => s.activeEvent?.groundAll)
  const dispatchAllParked = useGameStore((s) => s.dispatchAllParked)

  const parkedCount = useMemo(() => {
    let n = 0
    for (const r of routes) {
      const p = ownedAircraft.find((a) => a.instanceId === r.aircraftInstanceId)
      if (p?.flight?.status === 'IDLE') n++
    }
    return n
  }, [routes, ownedAircraft])

  const disabled = gameOver || !!groundAll || parkedCount === 0

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => dispatchAllParked()}
      title={
        groundAll
          ? 'Weather hold'
          : parkedCount === 0
            ? 'No parked aircraft on routes'
            : `Depart all ${parkedCount} parked`
      }
      className={[
        'btn-game',
        compact ? '!px-2.5 !py-1.5 !text-[10px]' : '!px-4 !py-2.5 !text-xs',
        disabled ? 'btn-game-ghost' : 'btn-game-success ready-pulse',
        className,
      ].join(' ')}
    >
      <span aria-hidden>✈</span>
      <span>
        {compact ? 'Fly all' : 'Fly all parked'}
        {parkedCount > 0 && (
          <span className="ml-1 tabular-nums opacity-90">
            ({formatNumber(parkedCount)})
          </span>
        )}
      </span>
    </button>
  )
}
