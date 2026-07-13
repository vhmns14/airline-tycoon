/**
 * Tiny Web Audio beeps (no asset files). Respects soundEnabled flag via caller.
 */

let ctx: AudioContext | null = null

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null
  try {
    if (!ctx) {
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext
      ctx = new AC()
    }
    return ctx
  } catch {
    return null
  }
}

export type SfxKind =
  | 'depart'
  | 'land'
  | 'money'
  | 'warn'
  | 'achieve'
  | 'click'
  | 'hangar'

export function playSfx(kind: SfxKind, enabled: boolean): void {
  if (!enabled) return
  const ac = getCtx()
  if (!ac) return
  void ac.resume()

  const now = ac.currentTime

  if (kind === 'hangar') {
    // Soft ambient hum (short pulse — call occasionally)
    const o = ac.createOscillator()
    const g = ac.createGain()
    o.type = 'sine'
    o.frequency.setValueAtTime(90, now)
    o.connect(g)
    g.connect(ac.destination)
    g.gain.setValueAtTime(0.0001, now)
    g.gain.exponentialRampToValueAtTime(0.02, now + 0.3)
    g.gain.exponentialRampToValueAtTime(0.0001, now + 1.8)
    o.start(now)
    o.stop(now + 1.9)
    return
  }

  if (kind === 'land') {
    const o1 = ac.createOscillator()
    const o2 = ac.createOscillator()
    const g = ac.createGain()
    o1.type = 'triangle'
    o2.type = 'sine'
    o1.frequency.setValueAtTime(520, now)
    o1.frequency.exponentialRampToValueAtTime(280, now + 0.18)
    o2.frequency.setValueAtTime(220, now)
    o1.connect(g)
    o2.connect(g)
    g.connect(ac.destination)
    g.gain.setValueAtTime(0.0001, now)
    g.gain.exponentialRampToValueAtTime(0.07, now + 0.03)
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.28)
    o1.start(now)
    o2.start(now)
    o1.stop(now + 0.3)
    o2.stop(now + 0.3)
    return
  }

  const o = ac.createOscillator()
  const g = ac.createGain()
  o.connect(g)
  g.connect(ac.destination)

  const map: Record<
    Exclude<SfxKind, 'hangar' | 'land'>,
    { f: number; d: number; type: OscillatorType }
  > = {
    depart: { f: 380, d: 0.14, type: 'triangle' },
    money: { f: 620, d: 0.16, type: 'sine' },
    warn: { f: 200, d: 0.2, type: 'square' },
    achieve: { f: 780, d: 0.22, type: 'sine' },
    click: { f: 480, d: 0.05, type: 'triangle' },
  }
  const m = map[kind]
  o.type = m.type
  o.frequency.setValueAtTime(m.f, now)
  g.gain.setValueAtTime(0.0001, now)
  g.gain.exponentialRampToValueAtTime(0.07, now + 0.02)
  g.gain.exponentialRampToValueAtTime(0.0001, now + m.d)
  o.start(now)
  o.stop(now + m.d + 0.02)
}

let hangarTimer: number | null = null

/** Soft hangar ambient pulse while sound enabled. */
export function startHangarAmbience(enabled: boolean): void {
  stopHangarAmbience()
  if (!enabled || typeof window === 'undefined') return
  playSfx('hangar', true)
  hangarTimer = window.setInterval(() => playSfx('hangar', true), 12_000)
}

export function stopHangarAmbience(): void {
  if (hangarTimer != null) {
    window.clearInterval(hangarTimer)
    hangarTimer = null
  }
}
