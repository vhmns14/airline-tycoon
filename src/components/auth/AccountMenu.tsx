/**
 * Top-bar account + cloud sync indicator.
 */

import { useState } from 'react'
import { useAuthStore } from '../../store/authStore'
import { AuthModal } from './AuthModal'

export function AccountMenu() {
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const syncStatus = useAuthStore((s) => s.syncStatus)
  const syncMessage = useAuthStore((s) => s.syncMessage)
  const lastSyncedAt = useAuthStore((s) => s.lastSyncedAt)
  const [open, setOpen] = useState(false)

  const statusDot =
    syncStatus === 'saving' || syncStatus === 'loading'
      ? 'bg-amber-400 animate-pulse'
      : syncStatus === 'error'
        ? 'bg-red-400'
        : syncStatus === 'saved'
          ? 'bg-emerald-400'
          : 'bg-slate-600'

  return (
    <>
      <div className="flex items-center gap-2">
        {user ? (
          <div className="flex items-center gap-2">
            <span
              className={`h-2 w-2 shrink-0 rounded-full ${statusDot}`}
              title={
                syncMessage ??
                (lastSyncedAt
                  ? `Last sync ${new Date(lastSyncedAt).toLocaleTimeString()}`
                  : 'Cloud sync')
              }
            />
            <span
              className="hidden max-w-[7rem] truncate text-xs font-medium text-slate-300 sm:inline"
              title={user.username}
            >
              @{user.username}
            </span>
            <button
              type="button"
              onClick={() => {
                if (
                  window.confirm(
                    'Log out? Progress stays on this device (local) and in the cloud. You can log in again later.',
                  )
                ) {
                  logout()
                }
              }}
              className="rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs font-semibold text-slate-300 hover:border-slate-500 hover:bg-slate-800"
            >
              Log out
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="rounded-lg border border-sky-500/40 bg-sky-500/10 px-2.5 py-1.5 text-xs font-semibold text-sky-300 hover:bg-sky-500/20"
          >
            Log in / Save
          </button>
        )}
      </div>
      <AuthModal open={open} onClose={() => setOpen(false)} />
    </>
  )
}
