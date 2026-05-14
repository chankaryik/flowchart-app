import { expect, test } from '@playwright/test'

import { SEED, readStoredPayload } from './helpers'

test('turning persist on snapshots edits made while persist was disabled', async ({ page }) => {
  await page.goto(`/node/${SEED.comment}`)
  await expect(page.getByTestId('node-details-drawer')).toBeVisible()

  await page.locator('#comment-name').fill('Persisted after toggle')
  await page.locator('button[type="submit"]').click()
  await page.waitForURL('/')
  await expect(page.getByText('Persisted after toggle').first()).toBeVisible()

  await page.getByTestId('persist-switch').click()

  const stored = (await readStoredPayload(page)) as Array<{ id: string; name?: string }> | null
  const target = stored?.find((node) => node.id === SEED.comment)
  expect(target?.name).toBe('Persisted after toggle')

  await page.reload()
  await expect(page.getByText('Persisted after toggle').first()).toBeVisible()
})
