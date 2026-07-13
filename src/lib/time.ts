/**
 * Wall-clock / local-time display helpers.
 */

/** User's local time, e.g. "14:30:05" (locale-aware). */
export function formatLocalTime(date: Date = new Date()): string {
  return date.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

/** User's local date key for revenue day boundaries: "YYYY-MM-DD". */
export function localDayKey(date: Date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Remaining milliseconds → "HH:MM" (ceil to whole minutes). */
export function formatDurationHm(remainingMs: number): string {
  const totalMin = Math.max(0, Math.ceil(remainingMs / 60_000))
  const hours = Math.floor(totalMin / 60)
  const minutes = totalMin % 60
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

/** Whole local calendar days between two timestamps (floor). */
export function calendarDaysBetween(fromMs: number, toMs: number): number {
  if (toMs <= fromMs) return 0
  return Math.floor((toMs - fromMs) / (24 * 60 * 60 * 1000))
}
