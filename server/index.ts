/**
 * Local API process (long-running).
 * Run: npx tsx --env-file-if-exists=.env --experimental-sqlite server/index.ts
 */

import { adminReady, app } from './app'

const PORT = Number(process.env.PORT ?? 3001)

await adminReady

app.listen(PORT, () => {
  console.log(`Airline Tycoon API → http://localhost:${PORT}`)
})
