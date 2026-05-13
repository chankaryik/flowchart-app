import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import AddNodeButton from '../AddNodeButton.vue'
import { useFlowStore } from '@/stores/flow'

beforeEach(() => {
  setActivePinia(createPinia())
})

describe('AddNodeButton', () => {
  it('opens the create dialog with the supplied parentId', async () => {
    const store = useFlowStore()
    expect(store.createDialog).toEqual({ open: false, parentId: null })

    const wrapper = mount(AddNodeButton, { props: { parentId: 'abc' } })
    await wrapper.find('[data-testid="add-node-button"]').trigger('click')

    expect(store.createDialog.open).toBe(true)
    expect(store.createDialog.parentId).toBe('abc')
  })

  it('handles numeric parent ids (the seed trigger uses id=1)', async () => {
    const store = useFlowStore()
    const wrapper = mount(AddNodeButton, { props: { parentId: 1 } })
    await wrapper.find('[data-testid="add-node-button"]').trigger('click')
    expect(store.createDialog.parentId).toBe(1)
  })

  it('stops click propagation so the underlying node click handler stays silent', async () => {
    // FlowCanvas.onNodeClick would otherwise also fire and push /node/:id.
    let bubbled = false
    const wrapper = mount(
      {
        components: { AddNodeButton },
        template: '<div @click="onParentClick"><AddNodeButton parent-id="p" /></div>',
        methods: { onParentClick() { bubbled = true } },
      },
      {},
    )
    await wrapper.find('[data-testid="add-node-button"]').trigger('click')
    expect(bubbled).toBe(false)
  })

  it('carries the Vue Flow `nodrag` class so dragging the canvas node is not started', () => {
    const wrapper = mount(AddNodeButton, { props: { parentId: 'x' } })
    const button = wrapper.find('[data-testid="add-node-button"]')
    expect(button.classes()).toContain('nodrag')
  })
})
