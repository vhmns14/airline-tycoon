/**
 * Persist SQLite file to Vercel Blob so serverless instances share one DB.
 * Local dev without BLOB_READ_WRITE_TOKEN skips blob (uses local file only).
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { get, put } from '@vercel/blob'

export const DB_BLOB_PATH = 'data/airline-tycoon.db'

let pullDone = false
let pushQueue: Promise<void> = Promise.resolve()
let dirty = false

function blobEnabled(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN)
}

async function streamToBuffer(
  stream: ReadableStream<Uint8Array>,
): Promise<Buffer> {
  const reader = stream.getReader()
  const chunks: Uint8Array[] = []
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    if (value) chunks.push(value)
  }
  return Buffer.concat(chunks.map((c) => Buffer.from(c)))
}

/**
 * Download remote DB into dbPath before opening SQLite (cold start).
 */
export async function pullDbFromBlob(
  dbPath: string,
  force = false,
): Promise<boolean> {
  if (!blobEnabled()) return false
  if (pullDone && !force) return false

  try {
    const result = await get(DB_BLOB_PATH, {
      access: 'private',
      useCache: false,
      token: process.env.BLOB_READ_WRITE_TOKEN,
    })

    if (!result || result.statusCode === 304 || !result.stream) {
      pullDone = true
      console.log('Blob DB: no remote file yet (fresh store)')
      return false
    }

    const buf = await streamToBuffer(result.stream)
    writeFileSync(dbPath, buf)
    pullDone = true
    console.log(
      `Blob DB: hydrated ${dbPath} (${buf.length} bytes from ${result.blob.pathname})`,
    )
    return true
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    // Not found is normal on first deploy
    if (/not found|404/i.test(msg)) {
      console.log('Blob DB: no remote file yet (fresh store)')
    } else {
      console.error('Blob DB pull error', err)
    }
    pullDone = true
    return false
  }
}

/** Mark local DB as needing upload after a mutation. */
export function markDbDirty(): void {
  if (!blobEnabled()) return
  dirty = true
}

/**
 * Upload local SQLite file to Blob (await after mutations).
 */
export async function pushDbToBlob(
  dbPath: string,
  checkpoint?: () => void,
): Promise<void> {
  if (!blobEnabled()) return

  pushQueue = pushQueue.then(async () => {
    if (!dirty) return
    try {
      try {
        checkpoint?.()
      } catch (e) {
        console.warn('Blob DB checkpoint warn', e)
      }
      if (!existsSync(dbPath)) return
      const body = readFileSync(dbPath)
      await put(DB_BLOB_PATH, body, {
        access: 'private',
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: 'application/octet-stream',
        token: process.env.BLOB_READ_WRITE_TOKEN,
      })
      dirty = false
      console.log(`Blob DB: uploaded ${body.length} bytes → ${DB_BLOB_PATH}`)
    } catch (err) {
      console.error('Blob DB push error', err)
    }
  })

  await pushQueue
}

/** Force mark dirty + push (e.g. after admin bootstrap creates user). */
export async function flushDbNow(
  dbPath: string,
  checkpoint?: () => void,
): Promise<void> {
  dirty = true
  await pushDbToBlob(dbPath, checkpoint)
}
