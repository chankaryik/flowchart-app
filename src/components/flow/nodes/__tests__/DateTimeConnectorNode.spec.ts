import { describe, expect, it } from 'vitest'

import DateTimeConnectorNode from '../DateTimeConnectorNode.vue'
import { mountNode } from './helpers'

describe('DateTimeConnectorNode (display-only invariant)', () => {
  it('renders with tabindex=-1 and no click/keyboard handlers (CLAUDE.md §8.1)', () => {
    const wrapper = mountNode(DateTimeConnectorNode, {
      id: 's',
      data: {
        id: 's',
        parentId: 'dt',
        type: 'dateTimeConnector',
        name: 'Success',
        data: { connectorType: 'success' },
      },
    })
    const root = wrapper.find('[data-node-type="dateTimeConnector"]')
    expect(root.attributes('tabindex')).toBe('-1')
    expect(root.attributes('onclick')).toBeUndefined()
    expect(root.attributes('onkeydown')).toBeUndefined()
  })
})
