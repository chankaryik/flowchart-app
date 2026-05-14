import { expect, type Locator, type Page } from '@playwright/test'

// Keep aligned with src/lib/payload-adapter.ts STORAGE_KEY.
export const STORAGE_KEY = 'payload-v1'
// Keep aligned with src/lib/payload-adapter.ts POSITIONS_STORAGE_KEY.
export const POSITIONS_STORAGE_KEY = 'payload-positions-v1'
// Keep aligned with src/lib/payload-adapter.ts PERSIST_ENABLED_KEY.
const PERSIST_ENABLED_KEY = 'persist-enabled-v1'

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
 * Per-test setup. Persistence is opted-in app-wide via a toggle in the header;
 * tests that verify state survives a reload need that toggle on. We set the
 * flag via addInitScript so it lands before FlowChartView's first paint AND
 * is re-applied on page.reload(). The payload itself (STORAGE_KEY) is never
 * touched here — only the boolean preference — so write-through state is
 * preserved across the reload.
 */
export async function resetState(page: Page): Promise<void> {
  await page.addInitScript((key) => {
    window.localStorage.setItem(key, '1')
  }, PERSIST_ENABLED_KEY)
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

export async function readStoredPositions(
  page: Page,
): Promise<Record<string, { x: number; y: number }> | null> {
  return page.evaluate((key) => {
    const raw = window.localStorage.getItem(key)
    if (raw == null) return null
    try {
      return JSON.parse(raw) as Record<string, { x: number; y: number }>
    } catch {
      return null
    }
  }, POSITIONS_STORAGE_KEY)
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
