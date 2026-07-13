/**
 * Export / import game save as JSON file (local backup).
 */

import type { GameState } from '../types'
import { hydrateGameState, serializeGameState, useGameStore } from '../store/gameStore'

export function exportSaveDownload(): void {
  const state = serializeGameState(useGameStore.getState())
  const blob = new Blob([JSON.stringify(state, null, 2)], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `airline-tycoon-save-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

export async function importSaveFromFile(file: File): Promise<string | null> {
  try {
    const text = await file.text()
    const data = JSON.parse(text) as Partial<GameState>
    if (!data || typeof data !== 'object') return 'Invalid save file'
    hydrateGameState(data)
    return null
  } catch {
    return 'Could not read save file'
  }
}
