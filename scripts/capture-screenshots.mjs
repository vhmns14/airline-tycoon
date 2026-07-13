/**
 * Capture README screenshots via Playwright + system Chromium.
 * Usage: SHOT_URL=http://localhost:5174 node scripts/capture-screenshots.mjs
 */
import { chromium } from 'playwright'
import { mkdir } from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT = path.join(__dirname, '..', 'docs', 'screenshots')
const BASE = process.env.SHOT_URL || 'http://localhost:5174'
const CHROME =
  process.env.CHROME_PATH || '/usr/bin/chromium-browser'

async function shot(page, name) {
  const file = path.join(OUT, `${name}.png`)
  await page.screenshot({ path: file, fullPage: false })
  console.log('wrote', file)
}

async function goTab(page, name) {
  // Only click *visible* nav buttons (desktop rail vs mobile dock)
  const byTitle = page.locator(`nav button[title="${name}"]`).locator('visible=true').first()
  if (await byTitle.count()) {
    await byTitle.click()
    await page.waitForTimeout(700)
    return true
  }
  const byText = page.locator(`nav button`).locator('visible=true').filter({ hasText: name }).first()
  if (await byText.count()) {
    await byText.click()
    await page.waitForTimeout(700)
    return true
  }
  // Mobile More sheet
  const more = page.locator('nav button[title="More"]').locator('visible=true').first()
  if (await more.count()) {
    await more.click()
    await page.waitForTimeout(350)
    const inner = page.locator('button').locator('visible=true').filter({ hasText: name }).first()
    if (await inner.count()) {
      await inner.click()
      await page.waitForTimeout(700)
      return true
    }
  }
  console.warn('tab not found:', name)
  return false
}

async function dismissOverlays(page) {
  for (let i = 0; i < 8; i++) {
    const btn = page
      .locator(
        'button:has-text("Skip"), button:has-text("Got it"), button:has-text("Next"), button:has-text("Done"), button:has-text("Close")',
      )
      .first()
    if (await btn.isVisible().catch(() => false)) {
      await btn.click().catch(() => {})
      await page.waitForTimeout(280)
    } else {
      break
    }
  }
}

async function main() {
  await mkdir(OUT, { recursive: true })
  console.log('BASE', BASE, 'CHROME', CHROME)

  const browser = await chromium.launch({
    executablePath: CHROME,
    headless: true,
    args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
  })
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  })

  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.evaluate(() => localStorage.clear())
  await page.reload({ waitUntil: 'networkidle', timeout: 60000 })
  await page.waitForTimeout(900)

  // 1) Founding
  await page.waitForSelector('text=Found your airline', { timeout: 20000 })
  await shot(page, '01-founding')

  await page.locator('button:has-text("Launch airline")').click()
  await page.waitForTimeout(1000)
  await dismissOverlays(page)
  await page.waitForTimeout(500)

  // 2) Ops dashboard
  await shot(page, '02-ops')

  // 3) Hangar — try lease/buy first plane
  await goTab(page, 'Hangar')
  await page.waitForTimeout(500)
  const leaseOrBuy = page
    .locator('button:has-text("Lease"), button:has-text("Buy")')
    .first()
  if (await leaseOrBuy.isVisible().catch(() => false)) {
    await leaseOrBuy.click()
    await page.waitForTimeout(500)
    const confirm = page
      .locator(
        'button:has-text("Confirm"), button:has-text("Add to fleet"), button:has-text("Done"), button:has-text("OK")',
      )
      .first()
    if (await confirm.isVisible().catch(() => false)) {
      await confirm.click().catch(() => {})
      await page.waitForTimeout(400)
    }
  }
  await shot(page, '03-hangar')

  // 4) Routes
  await goTab(page, 'Routes')
  await page.waitForTimeout(500)
  await shot(page, '04-routes')

  // 5) Map
  await goTab(page, 'Map')
  await page.waitForTimeout(1400)
  await shot(page, '05-map')

  // 6) Cargo board (scroll main)
  await page.locator('main').evaluate((el) => {
    el.scrollTop = el.scrollHeight
  })
  await page.waitForTimeout(500)
  await shot(page, '06-map-cargo')

  // Mobile shots
  await page.setViewportSize({ width: 390, height: 844 })
  await page.waitForTimeout(500)
  await goTab(page, 'Ops')
  await dismissOverlays(page)
  await page.waitForTimeout(400)
  await shot(page, '07-mobile-ops')

  await goTab(page, 'Map')
  await page.waitForTimeout(900)
  await shot(page, '08-mobile-map')

  await browser.close()
  console.log('done →', OUT)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
