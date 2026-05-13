import { describe, expect, it } from 'vitest'

import SendMessageNode from '../SendMessageNode.vue'
import type { SendMessageNode as SendMessageNodeShape } from '@/lib/types'
import { mountNode } from './helpers'

const baseNode: SendMessageNodeShape = {
  id: 'm1',
  parentId: 1,
  type: 'sendMessage',
  name: 'Welcome Message',
  data: {
    payload: [
      { type: 'text', text: 'Hello there' },
      { type: 'attachment', attachment: 'https://example.com/pic.jpg' },
      { type: 'attachment', attachment: 'https://example.com/pic2.jpg' },
    ],
  },
}

describe('SendMessageNode', () => {
  it('renders name, first-text preview and attachment count', () => {
    const wrapper = mountNode(SendMessageNode, { id: 'm1', data: baseNode })
    expect(wrapper.text()).toContain('Welcome Message')
    expect(wrapper.text()).toContain('Send Message')
    expect(wrapper.text()).toContain('Hello there')

    const badge = wrapper.find('[data-testid="attachment-count"]')
    expect(badge.exists()).toBe(true)
    expect(badge.text()).toBe('2')
    expect(badge.attributes('aria-label')).toBe('2 attachments')
  })

  it('hides the attachment badge when there are no attachments', () => {
    const wrapper = mountNode(SendMessageNode, {
      id: 'm1',
      data: {
        ...baseNode,
        data: { payload: [{ type: 'text', text: 'Just text' }] },
      },
    })
    expect(wrapper.find('[data-testid="attachment-count"]').exists()).toBe(false)
  })

  it('shows the empty preview when the payload has no text item', () => {
    const wrapper = mountNode(SendMessageNode, {
      id: 'm1',
      data: { ...baseNode, data: { payload: [] } },
    })
    expect(wrapper.text()).toContain('No message yet')
  })

  it('exposes target (top) and source (bottom) handles', () => {
    const wrapper = mountNode(SendMessageNode, { id: 'm1', data: baseNode })
    const handles = wrapper.findAll('[data-testid="handle"]')
    expect(handles).toHaveLength(2)
    const map = Object.fromEntries(
      handles.map((h) => [h.attributes('data-handle-type'), h.attributes('data-handle-position')]),
    )
    expect(map['target']).toBe('top')
    expect(map['source']).toBe('bottom')
  })
})
