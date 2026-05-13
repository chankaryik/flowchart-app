import { expect, test } from '@playwright/test'

import { SEED, expectNodeGone, expectNodeVisible, gotoCanvas, resetState } from './helpers'

test.beforeEach(async ({ page }) => {
  await resetState(page)
})

test('deletes the businessHours subtree (cascade)', async ({ page }) => {
  await gotoCanvas(page)

  // Open drawer for the dateTime node.
  await page.goto(`/node/${SEED.businessHours}`)
  await expect(page.getByTestId('node-details-drawer')).toBeVisible()

  await page.getByTestId('drawer-delete').click()
  await expect(page.getByTestId('delete-confirm')).toBeVisible()
  await page.getByTestId('delete-confirm-action').click()

  await page.waitForURL('/')

  // Cascade should remove dateTime + both connectors + welcome + away + comment.
  await expectNodeGone(page, SEED.businessHours)
  await expectNodeGone(page, SEED.welcomeMessage)
  await expectNodeGone(page, SEED.awayMessage)
  await expectNodeGone(page, SEED.comment)
  await expect(page.locator('[data-connector-type="success"]')).toHaveCount(0)
  await expect(page.locator('[data-connector-type="failure"]')).toHaveCount(0)

  // Trigger survives.
  await expectNodeVisible(page, SEED.trigger)
  await expect(page.getByText('1 nodes')).toBeVisible()
})

test('trigger drawer hides the Delete button (trigger is locked)', async ({ page }) => {
  await page.goto(`/node/${SEED.trigger}`)
  await expect(page.getByTestId('node-details-drawer')).toBeVisible()
  await expect(page.getByTestId('drawer-delete')).toHaveCount(0)
})

test('cancel on the confirm dialog leaves the node intact', async ({ page }) => {
  await page.goto(`/node/${SEED.comment}`)
  await page.getByTestId('drawer-delete').click()
  await page.getByTestId('delete-cancel').click()
  await expect(page.getByTestId('delete-confirm')).toHaveCount(0)
  // Drawer is still open and the node is still on the graph.
  await expect(page.getByTestId('node-details-drawer')).toBeVisible()
  await expectNodeVisible(page, SEED.comment)
})
