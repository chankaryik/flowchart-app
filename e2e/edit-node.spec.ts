import { expect, test } from '@playwright/test'

import { SEED, readStoredPayload, resetState } from './helpers'

test.beforeEach(async ({ page }) => {
  await resetState(page)
})

test('deep-link, edit, and save through the sendMessage drawer', async ({ page }) => {
  await page.goto(`/node/${SEED.welcomeMessage}`)
  await expect(page.getByTestId('node-details-drawer')).toBeVisible()

  const nameInput = page.locator('#sm-name')
  await expect(nameInput).toHaveValue('Welcome Message')

  await nameInput.fill('Welcome Message (edited)')
  await page.locator('button[type="submit"]').click()

  // Drawer closes via router.push('/').
  await page.waitForURL('/')

  // Card on the canvas reflects the new name.
  await expect(page.locator('text=Welcome Message (edited)').first()).toBeVisible()

  // Refresh proves the localStorage write-through.
  await page.reload()
  await expect(page.locator('text=Welcome Message (edited)').first()).toBeVisible()

  const stored = (await readStoredPayload(page)) as Array<{ id: string; name?: string }>
  const target = stored.find((n) => n.id === SEED.welcomeMessage)
  expect(target?.name).toBe('Welcome Message (edited)')
})

test('keeps Save disabled while the title is empty', async ({ page }) => {
  await page.goto(`/node/${SEED.comment}`)
  await expect(page.getByTestId('node-details-drawer')).toBeVisible()

  await page.locator('#comment-name').fill('')
  await page.locator('#comment-name').blur()
  await expect(page.getByTestId('name-error')).toBeVisible()
  await expect(page.locator('button[type="submit"]')).toBeDisabled()
})

test('editing the comment field persists across refresh', async ({ page }) => {
  await page.goto(`/node/${SEED.comment}`)
  await expect(page.getByTestId('node-details-drawer')).toBeVisible()

  const body = page.locator('#comment-body')
  await body.fill('E2E-edited comment body')
  await page.locator('button[type="submit"]').click()
  await page.waitForURL('/')

  await page.reload()
  await page.goto(`/node/${SEED.comment}`)
  await expect(page.locator('#comment-body')).toHaveValue('E2E-edited comment body')
})
