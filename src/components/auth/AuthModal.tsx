/**
 * Login / register for cloud progress.
 */

import { useState } from 'react'
import { useAuthStore } from '../../store/authStore'

type Mode = 'login' | 'register'

type AuthModalProps = {
  open: boolean
  onClose: () => void
}

export function AuthModal({ open, onClose }: AuthModalProps) {
  const login = useAuthStore((s) => s.login)
  const register = useAuthStore((s) => s.register)

  const [mode, setMode] = useState<Mode>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!open) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      if (mode === 'login') {
        await login(username.trim(), password)
      } else {
        await register(username.trim(), password)
      }
      setPassword('')
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-title"
    >
      <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <h2
              id="auth-title"
              className="text-xl font-bold text-slate-100"
            >
              {mode === 'login' ? 'Log in' : 'Create account'}
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              Save airline progress to the cloud so it survives browser clear
              and other devices.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-slate-500 hover:bg-slate-800 hover:text-slate-200"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="mb-4 flex rounded-xl border border-slate-700 p-0.5">
          <button
            type="button"
            onClick={() => {
              setMode('login')
              setError(null)
            }}
            className={[
              'flex-1 rounded-lg py-2 text-sm font-semibold transition',
              mode === 'login'
                ? 'bg-sky-600 text-white'
                : 'text-slate-400 hover:text-slate-200',
            ].join(' ')}
          >
            Log in
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('register')
              setError(null)
            }}
            className={[
              'flex-1 rounded-lg py-2 text-sm font-semibold transition',
              mode === 'register'
                ? 'bg-sky-600 text-white'
                : 'text-slate-400 hover:text-slate-200',
            ].join(' ')}
          >
            Register
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <label className="block space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Username
            </span>
            <input
              autoFocus
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. garuda_ceo"
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/30"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Password
            </span>
            <input
              type="password"
              autoComplete={
                mode === 'login' ? 'current-password' : 'new-password'
              }
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min. 6 characters"
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/30"
            />
          </label>

          {error && (
            <p
              className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300"
              role="alert"
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-xl bg-sky-600 py-2.5 text-sm font-bold text-white transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:bg-slate-700"
          >
            {busy
              ? 'Please wait…'
              : mode === 'login'
                ? 'Log in & sync'
                : 'Create account'}
          </button>
        </form>

        <p className="mt-4 text-center text-[11px] text-slate-600">
          Guest play still works offline via this browser. Login enables cloud
          backup (SQLite on the game server).
        </p>
      </div>
    </div>
  )
}
