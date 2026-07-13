/**
 * Game-style empty / tip banner.
 */

type EmptyStateProps = {
  title: string
  message: string
  hint?: string
}

export function EmptyState({ title, message, hint }: EmptyStateProps) {
  return (
    <div className="relative overflow-hidden rounded-lg border border-dashed border-[rgba(160,145,120,0.28)] bg-[var(--game-panel)] px-4 py-3.5 text-center">
      <p className="relative font-display text-xs font-semibold uppercase tracking-[0.14em] text-[var(--game-brass)]">
        {title}
      </p>
      <p className="relative mt-1.5 text-sm text-[var(--game-muted)]">
        {message}
      </p>
      {hint && (
        <p className="relative mt-2 inline-block rounded-md border border-[rgba(196,163,90,0.3)] bg-[rgba(196,163,90,0.08)] px-3 py-1 text-xs font-semibold text-[var(--game-brass)]">
          → {hint}
        </p>
      )}
    </div>
  )
}
