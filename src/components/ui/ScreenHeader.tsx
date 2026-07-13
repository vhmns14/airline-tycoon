/**
 * Compact page header used across tabs.
 */

import type { ReactNode } from 'react'

export function ScreenHeader({
  title,
  sub,
  right,
}: {
  title: string
  sub?: string
  right?: ReactNode
}) {
  return (
    <div className="col-span-full flex flex-wrap items-end justify-between gap-2">
      <div className="min-w-0">
        <h2 className="screen-title">{title}</h2>
        {sub && <p className="screen-sub mt-0.5">{sub}</p>}
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </div>
  )
}
