import { expect, test, type Page } from '@playwright/test'

import { SEED, gotoCanvas, nodeLocator, pressUndo, resetState } from './helpers'

test.beforeEach(async ({ page }) => {
  await resetState(page)
})

async function dragBy(
  page: Page,
  nodeId: string,
  dx: number,
  dy: number,
): Promise<{ before: { x: number; y: number }; after: { x: number; y: number } }> {
  const node = nodeLocator(page, nodeId)
  const before = await node.boundingBox()
  if (before == null) throw new Error(`No bounding box for node ${nodeId}`)

  const startX = before.x + before.width / 2
  const startY = before.y + before.height / 2
  // Vue Flow uses mousedown/mousemove/mouseup, so the native mouse helpers
  // drive the drag. A trio of moves prevents the throttle from collapsing
  // start and end into the same frame.
  await page.mouse.move(startX, startY)
  await page.mouse.down()
  await page.mouse.move(startX + dx / 2, startY + dy / 2)
  await page.mouse.move(startX + dx, startY + dy)
  await page.mouse.up()

  // Wait for the saveNodes() promise to flush the move to localStorage.
  await page.waitForTimeout(150)

  const after = await node.boundingBox()
  if (after == null) throw new Error(`Lost bounding box for ${nodeId} after drag`)
  return {
    before: { x: before.x, y: before.y },
    after: { x: after.x, y: after.y },
  }
}

test('dragging a node moves it and persists across refresh', async ({ page }) => {
  await gotoCanvas(page)

  const { before, after } = await dragBy(page, SEED.welcomeMessage, 180, 60)
  // Allow a small tolerance — Vue Flow snaps and the viewport pan can offset.
  expect(after.x - before.x).toBeGreaterThan(40)
  expect(after.y - before.y).toBeGreaterThan(20)

  await page.reload()
  const node = nodeLocator(page, SEED.welcomeMessage)
  const reloaded = await node.boundingBox()
  expect(reloaded).not.toBeNull()
  // Refresh re-fits the viewport so we can't compare absolute coordinates,
  // but we can compare to the trigger card as a stable reference.
  const trigger = await nodeLocator(page, SEED.trigger).boundingBox()
  if (reloaded == null || trigger == null) throw new Error('Missing bounding boxes')
  const dxFromTrigger = reloaded.x - trigger.x
  expect(Math.abs(dxFromTrigger)).toBeGreaterThan(50)
})

test('a single Ctrl+Z reverses one drag-end, even when many drag events fired', async ({ page }) => {
  await gotoCanvas(page)

  const node = nodeLocator(page, SEED.welcomeMessage)
  const before = await node.boundingBox()
  if (before == null) throw new Error('No bounding box before drag')

  await dragBy(page, SEED.welcomeMessage, 220, 80)

  await pressUndo(page)
  await page.waitForTimeout(150)

  const after = await node.boundingBox()
  if (after == null) throw new Error('No bounding box after undo')
  // The undo restores the original position (within a couple of pixels).
  expect(Math.abs(after.x - before.x)).toBeLessThan(5)
  expect(Math.abs(after.y - before.y)).toBeLessThan(5)
})
