/**
 * Game toasts — portaled to document.body, top-right, auto-dismiss.
 */

import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useGameStore } from '../../store/gameStore'

/** How long a toast stays visible (ms). */
const TOAST_TTL_MS = 4_000

export function NotificationToasts() {
  const notes = useGameStore((s) => s.notifications)
  const dismiss = useGameStore((s) => s.dismissNotification)
  /** Ids that already have an auto-dismiss timer running. */
  const scheduled = useRef(new Set<string>())

  useEffect(() => {
    if (!notes?.length) {
      scheduled.current.clear()
      return
    }

    for (const n of notes.slice(0, 4)) {
      if (scheduled.current.has(n.id)) continue
      scheduled.current.add(n.id)

      const age = Date.now() - (n.at ?? Date.now())
      const wait = Math.max(0, TOAST_TTL_MS - age)

      window.setTimeout(() => {
        useGameStore.getState().dismissNotification(n.id)
        scheduled.current.delete(n.id)
      }, wait)
    }

    const live = new Set(notes.map((n) => n.id))
    for (const id of [...scheduled.current]) {
      if (!live.has(id)) scheduled.current.delete(id)
    }
  }, [notes])

  if (!notes?.length) return null
  if (typeof document === 'undefined') return null

  return createPortal(
    <div
      className="pointer-events-none fixed right-3 top-3 z-[9999] flex w-[min(100%-1.5rem,22rem)] flex-col gap-2 sm:right-4 sm:top-4"
      style={{ position: 'fixed', top: 12, right: 12, zIndex: 9999 }}
      aria-live="polite"
    >
      {notes.slice(0, 4).map((n) => (
        <button
          key={n.id}
          type="button"
          onClick={() => dismiss(n.id)}
          className={[
            'game-toast pointer-events-auto text-left',
            n.tone === 'good'
              ? 'border-[rgba(143,173,122,0.4)] text-[var(--game-cash)]'
              : n.tone === 'bad'
                ? 'border-[rgba(184,92,74,0.45)] text-[var(--game-danger)]'
                : n.tone === 'warn'
                  ? 'border-[rgba(196,163,90,0.4)] text-[var(--game-brass)]'
                  : 'border-[rgba(160,145,120,0.25)] text-[var(--game-text)]',
          ].join(' ')}
        >
          <span className="mb-0.5 flex items-center justify-between gap-2">
            <span className="font-display text-[9px] font-semibold uppercase tracking-[0.14em] opacity-70">
              {n.tone === 'good'
                ? '✓ Done'
                : n.tone === 'bad'
                  ? '✕ Alert'
                  : n.tone === 'warn'
                    ? '⚠ Notice'
                    : '· Note'}
            </span>
            <span className="text-[9px] opacity-40">×</span>
          </span>
          {n.text}
        </button>
      ))}
    </div>,
    document.body,
  )
}
