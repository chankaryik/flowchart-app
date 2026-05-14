import { expect, test, type Locator, type Page } from '@playwright/test'

import { SEED, gotoCanvas, nodeLocator, pressUndo, readStoredPositions, resetState } from './helpers'

test.beforeEach(async ({ page }) => {
  await resetState(page)
})

type Box = { x: number; y: number; width: number; height: number }

async function requireBox(node: Locator, label: string): Promise<Box> {
  const box = await node.boundingBox()
  if (box == null) throw new Error(`No bounding box for ${label}`)
  return box
}

async function dragBy(
  page: Page,
  nodeId: string,
  dx: number,
  dy: number,
): Promise<{ before: { x: number; y: number }; after: { x: number; y: number } }> {
  const node = nodeLocator(page, nodeId)
  const before = await requireBox(node, `node ${nodeId}`)

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

  const after = await requireBox(node, `${nodeId} after drag`)
  return {
    before: { x: before.x, y: before.y },
    after: { x: after.x, y: after.y },
  }
}

test('dragging a node moves it in the current session', async ({ page }) => {
  await gotoCanvas(page)

  const { before, after } = await dragBy(page, SEED.welcomeMessage, 180, 60)
  // Allow a small tolerance — Vue Flow snaps and the viewport pan can offset.
  expect(after.x - before.x).toBeGreaterThan(40)
  expect(after.y - before.y).toBeGreaterThan(20)

})

test('dragging a node stores its position for refreshes', async ({ page }) => {
  await gotoCanvas(page)

  await dragBy(page, SEED.welcomeMessage, 180, 60)

  const stored = await readStoredPositions(page)
  expect(stored?.[SEED.welcomeMessage]?.x).toEqual(expect.any(Number))
  expect(stored?.[SEED.welcomeMessage]?.y).toEqual(expect.any(Number))
})

test('a single Ctrl+Z reverses one drag-end, even when many drag events fired', async ({ page }) => {
  await gotoCanvas(page)

  const node = nodeLocator(page, SEED.welcomeMessage)
  const before = await requireBox(node, 'welcome message before drag')

  await dragBy(page, SEED.welcomeMessage, 220, 80)

  await pressUndo(page)
  // Poll until the undo lands the node back near its original X (within 5px).
  await expect.poll(async () => (await node.boundingBox())?.x).toBeCloseTo(before.x, -1)

  const after = await requireBox(node, 'welcome message after undo')
  // The undo restores the original position (within a couple of pixels).
  expect(Math.abs(after.x - before.x)).toBeLessThan(5)
  expect(Math.abs(after.y - before.y)).toBeLessThan(5)
})
