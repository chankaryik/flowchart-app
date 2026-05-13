import { expect, test, type Page } from '@playwright/test'

import { gotoCanvas, pressRedo, pressUndo, resetState } from './helpers'

test.beforeEach(async ({ page }) => {
  await resetState(page)
})

async function openDialog(page: Page): Promise<void> {
  await page.getByTestId('create-node-button').click()
  await expect(page.getByTestId('create-node-dialog')).toBeVisible()
}

async function pickParent(page: Page, label: string): Promise<void> {
  await page.locator('#create-parent').click()
  await page.getByRole('option', { name: new RegExp(label) }).first().click()
}

async function createNode(
  page: Page,
  type: 'sendMessage' | 'dateTime' | 'addComment',
  name: string,
): Promise<void> {
  await openDialog(page)
  await page.locator(`[data-type-option="${type}"]`).click()
  await page.getByTestId('create-next').click()
  await pickParent(page, 'Trigger #1')
  await page.getByTestId('create-next').click()
  await page.locator('#create-name').fill(name)
  await page.getByTestId('create-submit').click()
  // Wait for the drawer URL push to land — proves the create completed.
  await page.waitForURL(/\/node\/[^/]+$/)
  // Close the drawer so the next undo doesn't have to fight focus.
  await page.locator('body').click({ position: { x: 5, y: 5 } })
  await page.waitForURL('/')
}

// dateTime adds 3 nodes (dateTime + 2 connectors); the others add 1.
const SCENARIOS = [
  { type: 'sendMessage' as const, name: 'Undoable SendMessage', expectedAfterCreate: 8, deltaAfterUndo: 7 },
  { type: 'dateTime' as const, name: 'Undoable DateTime', expectedAfterCreate: 10, deltaAfterUndo: 7 },
  { type: 'addComment' as const, name: 'Undoable Comment', expectedAfterCreate: 8, deltaAfterUndo: 7 },
]

for (const scenario of SCENARIOS) {
  test(`create → undo → redo for ${scenario.type}`, async ({ page }) => {
    await gotoCanvas(page)
    await expect(page.getByText('7 nodes')).toBeVisible()

    await createNode(page, scenario.type, scenario.name)

    await expect(page.getByText(`${scenario.expectedAfterCreate} nodes`)).toBeVisible()

    await pressUndo(page)
    await expect(page.getByText(`${scenario.deltaAfterUndo} nodes`)).toBeVisible()

    await pressRedo(page)
    await expect(page.getByText(`${scenario.expectedAfterCreate} nodes`)).toBeVisible()
  })
}
