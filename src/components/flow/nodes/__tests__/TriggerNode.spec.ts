import { describe, expect, it } from 'vitest'

import TriggerNode from '../TriggerNode.vue'
import type { TriggerNode as TriggerNodeShape } from '@/lib/types'
import { mountNode } from './helpers'

const triggerData: TriggerNodeShape = {
  id: 1,
  parentId: -1,
  type: 'trigger',
  data: { type: 'conversationOpened', oncePerContact: false },
}

describe('TriggerNode', () => {
  it('renders the humanized event type and once-per-contact label', () => {
    const wrapper = mountNode(TriggerNode, { id: '1', data: triggerData })
    expect(wrapper.text()).toContain('Trigger')
    expect(wrapper.text()).toContain('Conversation Opened')
    expect(wrapper.text()).toContain('Every time')
  })

  it('switches the indicator when oncePerContact is true', () => {
    const wrapper = mountNode(TriggerNode, {
      id: '1',
      data: { ...triggerData, data: { ...triggerData.data, oncePerContact: true } },
    })
    expect(wrapper.text()).toContain('Once per contact')
  })

  it('exposes a single source handle on the bottom (no incoming edges)', () => {
    const wrapper = mountNode(TriggerNode, { id: '1', data: triggerData })
    const handles = wrapper.findAll('[data-testid="handle"]')
    expect(handles).toHaveLength(1)
    expect(handles[0]!.attributes('data-handle-type')).toBe('source')
    expect(handles[0]!.attributes('data-handle-position')).toBe('bottom')
  })

  it('tags the rendered card with data-node-type="trigger"', () => {
    const wrapper = mountNode(TriggerNode, { id: '1', data: triggerData })
    expect(wrapper.find('[data-node-type="trigger"]').exists()).toBe(true)
  })

  it('renders an add-node plus button pointing at the trigger as parent', () => {
    const wrapper = mountNode(TriggerNode, { id: '1', data: triggerData })
    const button = wrapper.find('[data-testid="add-node-button"]')
    expect(button.exists()).toBe(true)
    expect(button.attributes('data-add-node-parent')).toBe('1')
  })
})
