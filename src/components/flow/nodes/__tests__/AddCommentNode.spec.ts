import { describe, expect, it } from 'vitest'

import AddCommentNode from '../AddCommentNode.vue'
import type { AddCommentNode as AddCommentNodeShape } from '@/lib/types'
import { mountNode } from './helpers'

const baseNode: AddCommentNodeShape = {
  id: 'c1',
  parentId: 'm1',
  type: 'addComment',
  name: 'After-hours note',
  data: { comment: 'User pinged us after business hours' },
}

describe('AddCommentNode', () => {
  it('renders the name and truncated comment preview', () => {
    const wrapper = mountNode(AddCommentNode, { id: 'c1', data: baseNode })
    expect(wrapper.text()).toContain('After-hours note')
    expect(wrapper.text()).toContain('Comment')
    expect(wrapper.text()).toContain('User pinged us after business hours')
  })

  it('shows the empty state when the comment is blank', () => {
    const wrapper = mountNode(AddCommentNode, {
      id: 'c1',
      data: { ...baseNode, data: { comment: '' } },
    })
    expect(wrapper.text()).toContain('No comment yet')
  })

  it('exposes target (top) and source (bottom) handles', () => {
    const wrapper = mountNode(AddCommentNode, { id: 'c1', data: baseNode })
    const handles = wrapper.findAll('[data-testid="handle"]')
    expect(handles).toHaveLength(2)
    const map = Object.fromEntries(
      handles.map((h) => [h.attributes('data-handle-type'), h.attributes('data-handle-position')]),
    )
    expect(map['target']).toBe('top')
    expect(map['source']).toBe('bottom')
  })

  it('tags the rendered card with data-node-type="addComment"', () => {
    const wrapper = mountNode(AddCommentNode, { id: 'c1', data: baseNode })
    expect(wrapper.find('[data-node-type="addComment"]').exists()).toBe(true)
  })

  it('renders an add-node plus button pointing at itself as parent', () => {
    const wrapper = mountNode(AddCommentNode, { id: 'c1', data: baseNode })
    const button = wrapper.find('[data-testid="add-node-button"]')
    expect(button.exists()).toBe(true)
    expect(button.attributes('data-add-node-parent')).toBe('c1')
  })
})
