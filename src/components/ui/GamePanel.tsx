/**
 * Shared chrome for in-game panels (framed + title bar).
 */

import type { ReactNode } from 'react'

type GamePanelProps = {
  title: string
  icon?: string
  right?: ReactNode
  children: ReactNode
  className?: string
  bodyClassName?: string
}

export function GamePanel({
  title,
  icon,
  right,
  children,
  className = '',
  bodyClassName = '',
}: GamePanelProps) {
  return (
    <section className={`game-panel ${className}`}>
      <header className="game-panel-header">
        <h3 className="game-panel-title flex items-center gap-1.5">
          {icon && <span className="text-sm normal-case tracking-normal">{icon}</span>}
          {title}
        </h3>
        {right && <div className="shrink-0">{right}</div>}
      </header>
      <div className={`game-panel-body ${bodyClassName}`}>{children}</div>
    </section>
  )
}
