import { expect, test, type Page } from '@playwright/test'

import { SEED, gotoCanvas, nodeLocator, resetState } from './helpers'

test.beforeEach(async ({ page }) => {
  await resetState(page)
})

async function focusedFlowNodeId(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    const active = document.activeElement
    if (!(active instanceof HTMLElement)) return null
    return active.getAttribute('data-flow-node-id')
  })
}

async function tabToNextFlowNode(page: Page): Promise<string> {
  await page.keyboard.press('Tab')
  const id = await focusedFlowNodeId(page)
  if (id == null) throw new Error('Tab did not move focus to a flow node')
  return id
}

test('Tab from a node cycles through editable nodes only (connectors skipped)', async ({ page }) => {
  await gotoCanvas(page)

  // Focus the trigger to enter the graph; useNodeKeyboard's Tab handler only
  // engages when focus is already on a flow node.
  await nodeLocator(page, SEED.trigger).focus()
  expect(await focusedFlowNodeId(page)).toBe(SEED.trigger)

  // Walk Tab through the whole graph; connectors must never appear.
  const visited = new Set<string>([SEED.trigger])
  for (let i = 0; i < 6; i++) {
    const id = await tabToNextFlowNode(page)
    expect(id).not.toBe(SEED.successConnector)
    expect(id).not.toBe(SEED.failureConnector)
    visited.add(id)
  }

  // Five editable nodes total → after enough Tabs we should have seen each.
  expect(visited).toContain(SEED.trigger)
  expect(visited).toContain(SEED.businessHours)
  expect(visited).toContain(SEED.welcomeMessage)
  expect(visited).toContain(SEED.awayMessage)
  expect(visited).toContain(SEED.comment)
})

test('Enter on a focused node opens its drawer, Esc closes it', async ({ page }) => {
  await gotoCanvas(page)
  await nodeLocator(page, SEED.welcomeMessage).focus()

  await page.keyboard.press('Enter')
  await page.waitForURL(`/node/${SEED.welcomeMessage}`)
  await expect(page.getByTestId('node-details-drawer')).toBeVisible()

  await page.keyboard.press('Escape')
  await page.waitForURL('/')
  await expect(page.getByTestId('node-details-drawer')).toHaveCount(0)
})

test('Arrow keys move focus to a graph-adjacent node', async ({ page }) => {
  await gotoCanvas(page)
  await nodeLocator(page, SEED.trigger).focus()

  // The dateTime sits directly below the trigger in the layout.
  await page.keyboard.press('ArrowDown')
  expect(await focusedFlowNodeId(page)).toBe(SEED.businessHours)
})

test('? opens the shortcut help dialog', async ({ page }) => {
  await gotoCanvas(page)
  // Focus the canvas body so the keydown fires outside of any input.
  await page.locator('body').click({ position: { x: 5, y: 5 } })
  await page.keyboard.press('?')
  await expect(page.getByTestId('shortcut-help')).toBeVisible()
})
