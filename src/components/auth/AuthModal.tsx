/**
 * Login / register for cloud progress.
 * Portaled to document.body so it is never trapped under the game shell.
 */

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
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

  // Esc to close
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  // Lock body scroll while open
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

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

  const body = (
    <div
      className="fixed inset-0 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      style={{ zIndex: 10000 }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="relative w-full max-w-md rounded-2xl border border-[rgba(196,163,90,0.28)] bg-[#1a1714] p-6 shadow-2xl"
        style={{ zIndex: 10001 }}
      >
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <h2
              id="auth-title"
              className="font-display text-xl font-bold text-[var(--game-text)]"
            >
              {mode === 'login' ? 'Log in' : 'Create account'}
            </h2>
            <p className="mt-1 text-sm text-[var(--game-muted)]">
              Save airline progress to the cloud so it survives browser clear
              and other devices.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-[var(--game-dim)] hover:bg-black/30 hover:text-[var(--game-text)]"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="mb-4 flex rounded-xl border border-[rgba(160,145,120,0.2)] p-0.5">
          <button
            type="button"
            onClick={() => {
              setMode('login')
              setError(null)
            }}
            className={[
              'flex-1 rounded-lg py-2 text-sm font-semibold transition',
              mode === 'login'
                ? 'bg-[rgba(196,163,90,0.25)] text-[var(--game-brass-hi)]'
                : 'text-[var(--game-dim)] hover:text-[var(--game-text)]',
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
                ? 'bg-[rgba(196,163,90,0.25)] text-[var(--game-brass-hi)]'
                : 'text-[var(--game-dim)] hover:text-[var(--game-text)]',
            ].join(' ')}
          >
            Register
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <label className="block space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--game-dim)]">
              Username
            </span>
            <input
              autoFocus
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. garuda_ceo"
              className="game-input w-full"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--game-dim)]">
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
              className="game-input w-full"
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
            className="btn-game btn-game-primary w-full !py-2.5"
          >
            {busy
              ? 'Please wait…'
              : mode === 'login'
                ? 'Log in & sync'
                : 'Create account'}
          </button>
        </form>

        <p className="mt-4 text-center text-[11px] text-[var(--game-dim)]">
          Guest play still works offline. Login enables cloud backup.
        </p>
      </div>
    </div>
  )

  return createPortal(body, document.body)
}
