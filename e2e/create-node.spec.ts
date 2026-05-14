import { expect, test, type Page } from '@playwright/test'

import { gotoCanvas, readStoredPayload, resetState, SEED } from './helpers'

test.beforeEach(async ({ page }) => {
  await resetState(page)
})

async function openCreateDialog(page: Page): Promise<void> {
  await page.getByTestId('create-node-button').click()
  await expect(page.getByTestId('create-node-dialog')).toBeVisible()
}

/**
 * Reka-UI Select renders its listbox in a portal. Pick an option by its
 * accessible name (the SelectItem text) — survives styling churn.
 */
async function selectType(page: Page, label: string): Promise<void> {
  await page.getByTestId('create-type').click()
  await page.getByRole('option', { name: new RegExp(`^${label}$`) }).click()
}

async function fillCreateForm(
  page: Page,
  values: { title: string; description?: string; type: string },
): Promise<void> {
  await page.getByTestId('create-title').fill(values.title)
  if (values.description != null) {
    await page.getByTestId('create-description').fill(values.description)
  }
  await selectType(page, values.type)
}

test('creates a standalone sendMessage from the header button', async ({ page }) => {
  await gotoCanvas(page)
  await openCreateDialog(page)

  await fillCreateForm(page, {
    title: 'E2E Send Message',
    description: 'Greets the customer',
    type: 'Send Message',
  })
  await page.getByTestId('create-submit').click()

  await expect(page.getByTestId('create-node-dialog')).toHaveCount(0)
  await page.waitForURL(/\/node\/[^/]+$/)

  // Header chip count goes from 7 → 8.
  await expect(page.getByText('8 nodes')).toBeVisible()

  await page.reload()
  await expect(page.getByText('8 nodes')).toBeVisible()
  await expect(page.locator('text=E2E Send Message').first()).toBeVisible()

  const stored = await readStoredPayload(page)
  expect(stored).not.toBeNull()
  expect((stored as unknown[])).toHaveLength(8)

  // The new node has parentId=-1 (orphan) and carries the description.
  const created = (stored as Array<Record<string, unknown>>).find(
    (n) => n.name === 'E2E Send Message',
  )
  expect(created?.parentId).toBe(-1)
  expect(created?.description).toBe('Greets the customer')
})

test('creates a Business Hours node with success/failure connectors (still standalone)', async ({
  page,
}) => {
  await gotoCanvas(page)
  await openCreateDialog(page)

  await fillCreateForm(page, { title: 'E2E Business Hours', type: 'Business Hours' })
  await page.getByTestId('create-submit').click()

  await page.waitForURL(/\/node\/[^/]+$/)
  // 7 seed + 1 dateTime + 2 connectors = 10.
  await expect(page.getByText('10 nodes')).toBeVisible()

  await expect(page.locator('[data-connector-type="success"]')).toHaveCount(2)
  await expect(page.locator('[data-connector-type="failure"]')).toHaveCount(2)

  await page.reload()
  await expect(page.getByText('10 nodes')).toBeVisible()
})

test('creates an Add Comments node', async ({ page }) => {
  await gotoCanvas(page)
  await openCreateDialog(page)

  await fillCreateForm(page, { title: 'E2E Comment', type: 'Add Comments' })
  await page.getByTestId('create-submit').click()

  await page.waitForURL(/\/node\/[^/]+$/)
  await expect(page.getByText('8 nodes')).toBeVisible()
  await expect(page.locator('text=E2E Comment').first()).toBeVisible()

  await page.reload()
  await expect(page.getByText('8 nodes')).toBeVisible()
})

test('Type of Node lists the three REQUIREMENTS.md options in order', async ({ page }) => {
  await gotoCanvas(page)
  await openCreateDialog(page)
  await page.getByTestId('create-type').click()
  const labels = await page.getByRole('option').allInnerTexts()
  expect(labels.map((l) => l.trim())).toEqual(['Send Message', 'Add Comments', 'Business Hours'])
})

test('per-node + button creates a child of the clicked node', async ({ page }) => {
  await gotoCanvas(page)

  // The trigger has a + button below it (parent preset).
  await page
    .locator(`[data-flow-node-id="${SEED.trigger}"]`)
    .locator('[data-testid="add-node-button"]')
    .click()
  await expect(page.getByTestId('create-node-dialog')).toBeVisible()

  await fillCreateForm(page, { title: 'Child of trigger', type: 'Send Message' })
  await page.getByTestId('create-submit').click()
  await page.waitForURL(/\/node\/[^/]+$/)

  const stored = await readStoredPayload(page)
  const created = (stored as Array<Record<string, unknown>>).find(
    (n) => n.name === 'Child of trigger',
  )
  // parentId is the trigger's id (numeric 1 in payload.json).
  expect(created?.parentId).toBe(1)
})
