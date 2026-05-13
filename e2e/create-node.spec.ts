import { expect, test, type Page } from '@playwright/test'

import { gotoCanvas, readStoredPayload, resetState } from './helpers'

test.beforeEach(async ({ page }) => {
  await resetState(page)
})

async function openCreateDialog(page: Page): Promise<void> {
  await page.getByTestId('create-node-button').click()
  await expect(page.getByTestId('create-node-dialog')).toBeVisible()
}

/**
 * Reka-UI Select renders its listbox in a portal with role="option" items
 * whose accessible name is the SelectItem text. Use that contract — it survives
 * styling churn better than picking by data-value attributes.
 */
async function selectParentByLabel(page: Page, label: string): Promise<void> {
  await page.locator('#create-parent').click()
  await page.getByRole('option', { name: new RegExp(label) }).first().click()
}

test('creates a sendMessage under the trigger and persists it', async ({ page }) => {
  await gotoCanvas(page)
  await openCreateDialog(page)

  await page.locator('[data-type-option="sendMessage"]').click()
  await page.getByTestId('create-next').click()

  await selectParentByLabel(page, 'Trigger #1')
  await page.getByTestId('create-next').click()

  await page.locator('#create-name').fill('E2E Send Message')
  await page.getByTestId('create-submit').click()

  // Dialog closes, drawer opens for the new node (URL changes to /node/<id>).
  await expect(page.getByTestId('create-node-dialog')).toHaveCount(0)
  await page.waitForURL(/\/node\/[^/]+$/)

  // Header chip count goes from 7 → 8.
  await expect(page.getByText('8 nodes')).toBeVisible()

  // Reload to prove localStorage write-through.
  await page.reload()
  await expect(page.getByText('8 nodes')).toBeVisible()
  await expect(page.locator('text=E2E Send Message').first()).toBeVisible()

  const stored = await readStoredPayload(page)
  expect(stored).not.toBeNull()
  expect((stored as unknown[])).toHaveLength(8)
})

test('creates a dateTime node along with success and failure connectors', async ({ page }) => {
  await gotoCanvas(page)
  await openCreateDialog(page)

  await page.locator('[data-type-option="dateTime"]').click()
  await page.getByTestId('create-next').click()
  await selectParentByLabel(page, 'Trigger #1')
  await page.getByTestId('create-next').click()
  await page.locator('#create-name').fill('E2E Business Hours')
  await page.getByTestId('create-submit').click()

  await page.waitForURL(/\/node\/[^/]+$/)

  // 7 seed + 1 dateTime + 2 connectors = 10.
  await expect(page.getByText('10 nodes')).toBeVisible()

  await expect(page.locator('[data-connector-type="success"]')).toHaveCount(2)
  await expect(page.locator('[data-connector-type="failure"]')).toHaveCount(2)

  await page.reload()
  await expect(page.getByText('10 nodes')).toBeVisible()
})

test('creates an addComment node', async ({ page }) => {
  await gotoCanvas(page)
  await openCreateDialog(page)

  await page.locator('[data-type-option="addComment"]').click()
  await page.getByTestId('create-next').click()
  await selectParentByLabel(page, 'Trigger #1')
  await page.getByTestId('create-next').click()
  await page.locator('#create-name').fill('E2E Comment')
  await page.getByTestId('create-submit').click()

  await page.waitForURL(/\/node\/[^/]+$/)
  await expect(page.getByText('8 nodes')).toBeVisible()
  await expect(page.locator('text=E2E Comment').first()).toBeVisible()

  await page.reload()
  await expect(page.getByText('8 nodes')).toBeVisible()
})

test('the Create dialog excludes trigger and connectors from the type picker', async ({ page }) => {
  await gotoCanvas(page)
  await openCreateDialog(page)
  const values = await page
    .locator('[data-type-option]')
    .evaluateAll((els) => els.map((el) => el.getAttribute('data-type-option')))
  expect(values).toEqual(['sendMessage', 'dateTime', 'addComment'])
})
