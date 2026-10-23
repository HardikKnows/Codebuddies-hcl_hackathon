// Drives the running RetailPulse app with Chrome and saves real screenshots (plus the on-screen boxes of the
// elements each scene zooms into) to public/footage/. Usage: node scripts/capture.mjs [shot ...]
//   APP_URL defaults to http://localhost:5180, a second frontend whose /api points at a copy of the demo
//   database, so the tickets and stock changes made while recording don't touch the live demo data.
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { chromium } from 'playwright-core'

const APP_URL = process.env.APP_URL ?? 'http://localhost:5180'
const OUT = new URL('../public/footage/', import.meta.url)
const MANIFEST = new URL('manifest.json', OUT)
const VIEWPORT = { width: 1440, height: 810 }
const AI_TIMEOUT = 180_000

await mkdir(OUT, { recursive: true })
const manifest = JSON.parse(await readFile(MANIFEST, 'utf8').catch(() => '{}'))

const browser = await chromium.launch({ channel: 'chrome', headless: true })

async function newPage() {
  const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 2, locale: 'en-IN' })
  const page = await context.newPage()
  // Freeze CSS animations and hide the text caret so every still is clean.
  await page.addInitScript(() => {
    const style = document.createElement('style')
    style.textContent = '*,*::before,*::after{caret-color:transparent!important}'
    document.addEventListener('DOMContentLoaded', () => document.head.appendChild(style))
  })
  return page
}

async function signIn(page, name) {
  await page.goto(`${APP_URL}/login`)
  await page.getByRole('button', { name: new RegExp(name) }).click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'))
  await page.waitForLoadState('networkidle')
}

async function box(locator) {
  const b = await locator.first().boundingBox()
  return b && { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) }
}

async function shot(page, name, boxes = {}) {
  await page.waitForTimeout(400)
  await page.screenshot({ path: new URL(`${name}.png`, OUT).pathname })
  const resolved = {}
  for (const [key, locator] of Object.entries(boxes)) resolved[key] = await box(locator)
  manifest[name] = { width: VIEWPORT.width, height: VIEWPORT.height, boxes: resolved }
  console.log('saved', name, JSON.stringify(resolved))
}

const panelOf = (page) => page.getByRole('dialog', { name: 'RetailPulse AI assistant' })

async function openAssistant(page) {
  // The launcher's label has changed while the UI is being worked on; accept both versions.
  await page.getByRole('button', { name: /Ask (RetailPulse AI|AI assistant)/ }).filter({ visible: true }).first().click()
  await panelOf(page).waitFor()
  await page.waitForTimeout(400)
}

async function ask(page, text, { send = true } = {}) {
  const panel = panelOf(page)
  const reset = panel.getByRole('button', { name: 'New conversation' })
  if (await reset.isVisible()) await reset.click()
  await panel.getByRole('textbox', { name: 'Message' }).fill(text)
  if (!send) return
  const started = Date.now()
  await panel.getByRole('button', { name: 'Send' }).click()
  await panel.getByText('Checking the catalog, policies and your orders…').waitFor({ state: 'detached', timeout: AI_TIMEOUT })
  await page.waitForTimeout(800)
  console.log(`  answered in ${((Date.now() - started) / 1000).toFixed(1)} s`)
}

// The assistant panel grown to its full conversation height (the viewport is stretched so nothing scrolls),
// saved on its own; boxes are relative to the panel.
async function panelShot(page, name, boxes = {}) {
  const panel = panelOf(page)
  const scroller = panel.locator('div.overflow-y-auto')
  const extra = await scroller.evaluate((el) => el.scrollHeight - el.clientHeight)
  await page.setViewportSize({ width: VIEWPORT.width, height: VIEWPORT.height + Math.max(0, extra) })
  await page.waitForTimeout(500)
  await panel.screenshot({ path: new URL(`${name}.png`, OUT).pathname })
  const origin = await box(panel)
  const resolved = { conversation: await box(scroller.locator(':scope > *').last()) }
  for (const [key, locator] of Object.entries(boxes)) resolved[key] = await box(locator)
  for (const [key, b] of Object.entries(resolved)) resolved[key] = b && { ...b, x: b.x - origin.x, y: b.y - origin.y }
  manifest[name] = { width: origin.w, height: origin.h, boxes: resolved }
  console.log('saved', name, `${origin.w}x${origin.h}`, JSON.stringify(resolved))
  await page.setViewportSize(VIEWPORT)
}

const shots = {
  async customer() {
    const page = await newPage()
    await page.goto(`${APP_URL}/login`)
    await page.waitForLoadState('networkidle')
    await shot(page, 'login')

    await signIn(page, 'Aarav Sharma')
    await shot(page, 'shop-catalog', {
      search: page.getByPlaceholder('Search laptops, phones, appliances…'),
      store: page.locator('header select'),
      grid: page.getByText('All products', { exact: true }).last(),
    })

    await page.getByPlaceholder('Search laptops, phones, appliances…').fill('laptop')
    await page.keyboard.press('Enter')
    await page.waitForLoadState('networkidle')
    await shot(page, 'shop-search', { search: page.getByPlaceholder('Search laptops, phones, appliances…') })

    await page.getByText('Aerion Swift 14', { exact: true }).first().click()
    await page.getByRole('heading', { name: 'Aerion Swift 14', exact: true }).waitFor()
    await page.waitForLoadState('networkidle')
    await shot(page, 'shop-product', { title: page.getByRole('heading', { level: 1 }) })
    await page.getByText('Availability by location').evaluate((el) => window.scrollBy(0, el.getBoundingClientRect().top - 110))
    await shot(page, 'shop-availability', { availability: page.getByText('Availability by location').locator('xpath=ancestor::section[1] | ancestor::div[contains(@class,"rounded")][1]').last() })

    await page.goto(`${APP_URL}/`)
    await page.waitForLoadState('networkidle')
    await openAssistant(page)
    await ask(page, 'Laptop for Java development under ₹80,000 that I can pick up today.', { send: false })
    await shot(page, 'ai-reco-typed', { input: panelOf(page).getByRole('textbox', { name: 'Message' }) })
    await ask(page, 'Laptop for Java development under ₹80,000 that I can pick up today.')
    await shot(page, 'ai-reco-screen')
    await panelShot(page, 'ai-reco', { interpreted: panelOf(page).getByText('Interpreted as').locator('..') })

    await ask(page, 'Can I return an opened mobile phone purchased online?')
    await panelShot(page, 'ai-policy', { sources: panelOf(page).getByText('Sources', { exact: true }).locator('..') })

    await ask(page, 'Can I pay with cryptocurrency?')
    await panelShot(page, 'ai-fallback')

    await ask(page, 'My order NM-100042 arrived with a cracked screen.')
    await panelShot(page, 'ai-support-proposal', { confirm: panelOf(page).getByRole('button', { name: 'Confirm and create ticket' }) })
    await panelOf(page).getByRole('button', { name: 'Confirm and create ticket' }).click()
    await panelOf(page).getByText('Ticket created', { exact: true }).waitFor({ timeout: 30_000 })
    await shot(page, 'ai-support-confirmed-screen')
    await panelShot(page, 'ai-support-confirmed', { done: panelOf(page).getByText('Ticket created', { exact: true }) })
    await page.context().close()
  },

  // The request just sent, while the assistant is still working on it.
  async asking() {
    const page = await newPage()
    await signIn(page, 'Aarav Sharma')
    await openAssistant(page)
    const panel = panelOf(page)
    await panel.getByRole('textbox', { name: 'Message' }).fill('Laptop for Java development under ₹80,000 that I can pick up today.')
    await panel.getByRole('button', { name: 'Send' }).click()
    await panel.getByText('Checking the catalog, policies and your orders…').waitFor()
    await shot(page, 'ai-reco-asking', {
      request: panel.locator('p.bg-brand-600').last(),
      status: panel.getByText('Checking the catalog, policies and your orders…'),
    })
    await panel.getByText('Checking the catalog, policies and your orders…').waitFor({ state: 'detached', timeout: AI_TIMEOUT })
    await page.context().close()
  },

  async manager() {
    const page = await newPage()
    await signIn(page, 'Priya Nair')
    if (!page.url().includes('/ops')) await page.goto(`${APP_URL}/ops`)
    await page.getByRole('heading', { name: 'Operations overview' }).waitFor()
    await page.waitForLoadState('networkidle')
    await shot(page, 'ops-overview', { lowStock: page.getByText('Low-stock alerts').first() })

    await page.goto(`${APP_URL}/ops/inventory`)
    await page.getByRole('heading', { name: 'Inventory' }).waitFor()
    await page.waitForLoadState('networkidle')
    await shot(page, 'ops-inventory')

    await openAssistant(page)
    await ask(page, 'Increase the stock of product P101 by 20 units')
    await panelShot(page, 'ai-stock-proposal', { confirm: panelOf(page).getByRole('button', { name: 'Confirm stock update' }) })
    await panelOf(page).getByRole('button', { name: 'Confirm stock update' }).click()
    await panelOf(page).getByText('Stock updated', { exact: true }).waitFor({ timeout: 30_000 })
    await page.waitForTimeout(1200)
    await shot(page, 'ai-stock-confirmed-screen')
    await panelShot(page, 'ai-stock-confirmed', { done: panelOf(page).getByText('Stock updated', { exact: true }) })
    await panelOf(page).getByRole('button', { name: 'Close assistant' }).click()

    await page.goto(`${APP_URL}/ops/tickets`)
    await page.waitForLoadState('networkidle')
    await shot(page, 'ops-tickets')

    await page.goto(`${APP_URL}/ops/audit`)
    await page.waitForLoadState('networkidle')
    await shot(page, 'ops-audit')
    await page.context().close()
  },
}

const wanted = process.argv.slice(2)
try {
  for (const name of wanted.length ? wanted : Object.keys(shots)) await shots[name]()
} finally {
  await writeFile(MANIFEST, JSON.stringify(manifest, null, 2))
  await browser.close()
}
