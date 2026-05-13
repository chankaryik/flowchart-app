import { describe, expect, it } from 'vitest'

import DateTimeConnectorNode from '../DateTimeConnectorNode.vue'
import type { DateTimeConnectorNode as DateTimeConnectorNodeShape } from '@/lib/types'
import { mountNode } from './helpers'

function makeNode(
  connectorType: 'success' | 'failure',
): DateTimeConnectorNodeShape {
  return {
    id: connectorType === 'success' ? 's' : 'f',
    parentId: 'dt',
    type: 'dateTimeConnector',
    name: connectorType === 'success' ? 'Success' : 'Failure',
    data: { connectorType },
  }
}

describe('DateTimeConnectorNode', () => {
  it('renders the Success pill with emerald styling', () => {
    const wrapper = mountNode(DateTimeConnectorNode, { id: 's', data: makeNode('success') })
    const root = wrapper.find('[data-node-type="dateTimeConnector"]')
    expect(root.exists()).toBe(true)
    expect(root.attributes('data-connector-type')).toBe('success')
    expect(root.text()).toContain('Success')
    expect(root.classes().some((c) => c.startsWith('bg-emerald'))).toBe(true)
  })

  it('renders the Failure pill with rose styling', () => {
    const wrapper = mountNode(DateTimeConnectorNode, { id: 'f', data: makeNode('failure') })
    const root = wrapper.find('[data-node-type="dateTimeConnector"]')
    expect(root.text()).toContain('Failure')
    expect(root.classes().some((c) => c.startsWith('bg-rose'))).toBe(true)
  })

  it('is display-only: tabindex=-1 and no click/keyboard handlers attached', () => {
    // CLAUDE.md §8.1 — connectors are never interactive. The component must not
    // declare its own click/keyboard handlers; FlowCanvas additionally filters
    // connector clicks from router-push.
    const wrapper = mountNode(DateTimeConnectorNode, { id: 's', data: makeNode('success') })
    const root = wrapper.find('[data-node-type="dateTimeConnector"]')
    expect(root.attributes('tabindex')).toBe('-1')
    expect(root.attributes('onclick')).toBeUndefined()
    expect(root.attributes('onkeydown')).toBeUndefined()
  })

  it('exposes target (top) and source (bottom) handles so edges connect through it', () => {
    const wrapper = mountNode(DateTimeConnectorNode, { id: 's', data: makeNode('success') })
    const handles = wrapper.findAll('[data-testid="handle"]')
    expect(handles).toHaveLength(2)
    const map = Object.fromEntries(
      handles.map((h) => [h.attributes('data-handle-type'), h.attributes('data-handle-position')]),
    )
    expect(map['target']).toBe('top')
    expect(map['source']).toBe('bottom')
  })
})
