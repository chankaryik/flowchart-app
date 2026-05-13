import { expect, type Locator, type Page } from '@playwright/test'

// Keep aligned with src/lib/payload-adapter.ts STORAGE_KEY.
export const STORAGE_KEY = 'payload-v1'

// Stable seed IDs from public/payload.json. Hard-coded so specs read as
// scenarios rather than as graph traversals.
export const SEED = {
  trigger: '1',
  businessHours: 'd09c08',
  successConnector: '161f52',
  failureConnector: '28c4b9',
  welcomeMessage: 'b0653a',
  awayMessage: 'b6a0c1',
  comment: 'e879e4',
} as const

/**
 * No-op marker for test entry points. Playwright spins up a fresh
 * BrowserContext for every test, so localStorage already starts empty — we
 * do NOT want an addInitScript here because it would also fire on page.reload()
 * and erase the write-through state we're trying to assert.
 */
export async function resetState(_page: Page): Promise<void> {
  // Intentional no-op; kept as a hook in case future tests need seeding.
}

/**
 * Goto the canvas and wait until at least one seed node has rendered.
 * Most specs start here.
 */
export async function gotoCanvas(page: Page): Promise<void> {
  await page.goto('/')
  await page.locator(`[data-flow-node-id="${SEED.trigger}"]`).waitFor({ state: 'visible' })
}

export function nodeLocator(page: Page, id: string): Locator {
  return page.locator(`[data-flow-node-id="${id}"]`)
}

export async function expectNodeVisible(page: Page, id: string): Promise<void> {
  await expect(nodeLocator(page, id)).toBeVisible()
}

export async function expectNodeGone(page: Page, id: string): Promise<void> {
  await expect(nodeLocator(page, id)).toHaveCount(0)
}

/**
 * Read the cached payload from localStorage. Returns null when the SPA hasn't
 * written one yet (e.g. before any mutation has run).
 */
export async function readStoredPayload(page: Page): Promise<unknown[] | null> {
  return page.evaluate((key) => {
    const raw = window.localStorage.getItem(key)
    if (raw == null) return null
    try {
      return JSON.parse(raw) as unknown[]
    } catch {
      return null
    }
  }, STORAGE_KEY)
}

/**
 * Press the platform-appropriate undo / redo chord.
 */
export async function pressUndo(page: Page): Promise<void> {
  await page.keyboard.press('Control+Z')
}

export async function pressRedo(page: Page): Promise<void> {
  await page.keyboard.press('Control+Shift+Z')
}
