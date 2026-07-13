/**
 * Lightweight AI rival airlines (demand pressure on OD pairs).
 */

import type { RivalAirline } from '../types'

export const DEFAULT_RIVALS: RivalAirline[] = [
  {
    id: 'garuda-ai',
    name: 'Nusantara Wings AI',
    logoEmoji: '🦅',
    routes: [
      'cgk|dps',
      'cgk|sub',
      'cgk|sin',
      'cgk|kno',
      'cgk|upg',
      'dps|sin',
    ],
  },
  {
    id: 'asia-ai',
    name: 'ASEAN Connect',
    logoEmoji: '🌏',
    routes: ['sin|bkk', 'sin|kul', 'sin|cgk', 'bkk|hkg', 'kul|cgk'],
  },
  {
    id: 'global-ai',
    name: 'Horizon Global',
    logoEmoji: '🌐',
    routes: ['sin|lhr', 'dxb|jfk', 'hnd|lax', 'cgk|jfk', 'syd|sin'],
  },
]

export function odKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`
}
