import { expect, test } from '@playwright/test'

import { SEED, resetState } from './helpers'

test.beforeEach(async ({ page }) => {
  await resetState(page)
})

test('opens the drawer for a valid editable node id', async ({ page }) => {
  await page.goto(`/node/${SEED.welcomeMessage}`)
  await expect(page.getByTestId('node-details-drawer')).toBeVisible()
  expect(new URL(page.url()).pathname).toBe(`/node/${SEED.welcomeMessage}`)
})

test('redirects /node/<connector-id> back to / (connectors are display-only)', async ({ page }) => {
  // Seed localStorage so the router guard's sync peek can short-circuit; this
  // mirrors how a returning user would deep-link directly to a connector.
  await page.goto('/')
  await page.locator(`[data-flow-node-id="${SEED.trigger}"]`).waitFor()

  await page.goto(`/node/${SEED.successConnector}`)
  await expect(page).toHaveURL('/')
  await expect(page.getByTestId('node-details-drawer')).toHaveCount(0)
})

test('redirects /node/<bogus-id> back to /', async ({ page }) => {
  await page.goto('/')
  await page.locator(`[data-flow-node-id="${SEED.trigger}"]`).waitFor()

  await page.goto('/node/does-not-exist')
  await expect(page).toHaveURL('/')
  await expect(page.getByTestId('node-details-drawer')).toHaveCount(0)
})

test('first-visit deep-link to a valid id still opens the drawer (post-hydration)', async ({ page }) => {
  // No prior /, so the router guard's localStorage peek returns null and the
  // FlowChartView watcher does the validation once the query hydrates.
  await page.goto(`/node/${SEED.comment}`)
  await expect(page.getByTestId('node-details-drawer')).toBeVisible()
})
