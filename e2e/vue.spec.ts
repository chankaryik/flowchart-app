import { test, expect } from '@playwright/test'

test('app root loads without errors', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveTitle(/./)
})
