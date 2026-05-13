import { describe, expect, it } from 'vitest'

import { H_GAP, NODE_HEIGHT, NODE_WIDTH, V_GAP, computeLayout } from '@/lib/layout'
import type { FlowNode } from '@/lib/types'

function trigger(id: number | string, parentId: number | string = -1): FlowNode {
  return {
    id,
    parentId,
    type: 'trigger',
    data: { type: 'conversationOpened', oncePerContact: false },
  }
}

function sendMessage(id: string, parentId: number | string): FlowNode {
  return {
    id,
    parentId,
    type: 'sendMessage',
    name: `msg-${id}`,
    data: { payload: [] },
  }
}

function dateTimeNode(id: string, parentId: number | string, connectors: string[]): FlowNode {
  return {
    id,
    parentId,
    type: 'dateTime',
    name: `dt-${id}`,
    data: { times: [], connectors, timezone: 'UTC', action: 'businessHours' },
  }
}

function connector(id: string, parentId: string, kind: 'success' | 'failure'): FlowNode {
  return {
    id,
    parentId,
    type: 'dateTimeConnector',
    name: kind,
    data: { connectorType: kind },
  }
}

describe('computeLayout', () => {
  it('returns an empty object for no nodes', () => {
    expect(computeLayout([])).toEqual({})
  })

  it('places a single trigger at the origin row', () => {
    const positions = computeLayout([trigger(1)])
    expect(positions['1']).toEqual({ x: 0, y: 0 })
  })

  it('places a parent and child stacked vertically', () => {
    const positions = computeLayout([trigger(1), sendMessage('a', 1)])
    const parent = positions['1']
    const child = positions['a']
    if (parent == null || child == null) throw new Error('missing positions')
    expect(child.y - parent.y).toBe(V_GAP + NODE_HEIGHT)
    // single child sits directly under parent
    expect(child.x).toBeCloseTo(parent.x)
  })

  it('lays out connectors as sibling columns under a dateTime', () => {
    const nodes: FlowNode[] = [
      trigger(1),
      dateTimeNode('dt', 1, ['ok', 'no']),
      connector('ok', 'dt', 'success'),
      connector('no', 'dt', 'failure'),
    ]
    const positions = computeLayout(nodes)
    const dt = positions['dt']
    const ok = positions['ok']
    const no = positions['no']
    if (dt == null || ok == null || no == null) throw new Error('missing positions')

    // both connectors at the same y, one level below the dateTime
    expect(ok.y).toBe(dt.y + V_GAP + NODE_HEIGHT)
    expect(no.y).toBe(ok.y)

    // connectors flank the dateTime symmetrically and don't overlap
    const dtCenter = dt.x + NODE_WIDTH / 2
    const okCenter = ok.x + NODE_WIDTH / 2
    const noCenter = no.x + NODE_WIDTH / 2
    expect(okCenter).toBeLessThan(dtCenter)
    expect(noCenter).toBeGreaterThan(dtCenter)
    expect(Math.abs(dtCenter - (okCenter + noCenter) / 2)).toBeLessThan(0.5)
    expect(noCenter - okCenter).toBeGreaterThanOrEqual(NODE_WIDTH + H_GAP - 0.5)
  })

  it('cascades grandchildren below their connector parents', () => {
    const nodes: FlowNode[] = [
      trigger(1),
      dateTimeNode('dt', 1, ['ok', 'no']),
      connector('ok', 'dt', 'success'),
      connector('no', 'dt', 'failure'),
      sendMessage('m1', 'ok'),
      sendMessage('m2', 'no'),
    ]
    const positions = computeLayout(nodes)
    const ok = positions['ok']
    const m1 = positions['m1']
    const m2 = positions['m2']
    if (ok == null || m1 == null || m2 == null) throw new Error('missing positions')
    expect(m1.y).toBe(ok.y + V_GAP + NODE_HEIGHT)
    expect(m2.y).toBe(m1.y)
    // single child sits directly under its connector parent
    expect(m1.x).toBeCloseTo(ok.x)
  })

  it('treats nodes whose parentId is absent from the set as roots', () => {
    // trigger.parentId is -1 which is not a node id → trigger is the root
    const positions = computeLayout([trigger(1), sendMessage('a', 1)])
    expect(positions['1']).toBeDefined()
    expect(positions['a']).toBeDefined()
  })
})
