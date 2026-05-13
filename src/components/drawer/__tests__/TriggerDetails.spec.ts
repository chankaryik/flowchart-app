import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import TriggerDetails from '../TriggerDetails.vue'
import type { TriggerNode } from '@/lib/types'

const node: TriggerNode = {
  id: 1,
  parentId: -1,
  type: 'trigger',
  data: { type: 'conversationOpened', oncePerContact: false },
}

describe('TriggerDetails', () => {
  it('renders the humanized event and oncePerContact value', () => {
    const wrapper = mount(TriggerDetails, { props: { node } })
    expect(wrapper.text()).toContain('Conversation Opened')
    expect(wrapper.text()).toContain('conversationOpened')
    expect(wrapper.text()).toContain('No')
  })

  it('shows Yes when oncePerContact is true', () => {
    const wrapper = mount(TriggerDetails, {
      props: { node: { ...node, data: { ...node.data, oncePerContact: true } } },
    })
    expect(wrapper.text()).toContain('Yes')
  })

  it('renders no form controls (read-only)', () => {
    const wrapper = mount(TriggerDetails, { props: { node } })
    expect(wrapper.find('input').exists()).toBe(false)
    expect(wrapper.find('textarea').exists()).toBe(false)
    expect(wrapper.find('button[type="submit"]').exists()).toBe(false)
  })
})
