import { expect, test } from '@playwright/test'

import { SEED, expectNodeVisible, gotoCanvas, resetState } from './helpers'

test.beforeEach(async ({ page }) => {
  await resetState(page)
})

test('seed graph renders with every node visible', async ({ page }) => {
  await gotoCanvas(page)

  // Editable nodes carry data-flow-node-id; verify each one.
  await expectNodeVisible(page, SEED.trigger)
  await expectNodeVisible(page, SEED.businessHours)
  await expectNodeVisible(page, SEED.welcomeMessage)
  await expectNodeVisible(page, SEED.awayMessage)
  await expectNodeVisible(page, SEED.comment)

  // Connectors render as display-only chips; assert by connector-type instead.
  await expect(page.locator('[data-connector-type="success"]')).toBeVisible()
  await expect(page.locator('[data-connector-type="failure"]')).toBeVisible()

  // Header chip reflects the hydrated node count.
  await expect(page.getByText('7 nodes')).toBeVisible()
})

test('renders one smoothstep edge per non-trigger node', async ({ page }) => {
  await gotoCanvas(page)

  // Vue Flow renders edges as SVG <path> with class vue-flow__edge-path.
  // Seven seed nodes → six edges (trigger has no parent edge).
  const edges = page.locator('.vue-flow__edge-path')
  await expect(edges).toHaveCount(6)
})
