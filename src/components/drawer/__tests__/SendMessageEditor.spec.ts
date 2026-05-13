import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { SendMessageNode } from '@/lib/types'
import { makeUpdateNodeMock, mountEditor, type MutateAsyncMock } from './helpers'

let updateNodeMock: ReturnType<typeof makeUpdateNodeMock>

vi.mock('@/queries/nodes', () => ({
  useUpdateNode: () => updateNodeMock,
}))

const { default: SendMessageEditor } = await import('../SendMessageEditor.vue')

const baseNode: SendMessageNode = {
  id: 'm1',
  parentId: 1,
  type: 'sendMessage',
  name: 'Welcome',
  data: {
    payload: [
      { type: 'text', text: 'Hello' },
      { type: 'attachment', attachment: 'https://example.com/a.png' },
    ],
  },
}

function mutateAsyncMock(): MutateAsyncMock {
  return updateNodeMock.mutateAsync
}

beforeEach(() => {
  updateNodeMock = makeUpdateNodeMock()
})

describe('SendMessageEditor', () => {
  it('seeds the form with the current name and payload rows', () => {
    const wrapper = mountEditor(SendMessageEditor, { node: baseNode })
    expect(wrapper.find<HTMLInputElement>('#sm-name').element.value).toBe('Welcome')
    expect(wrapper.findAll('[data-row-kind="text"]')).toHaveLength(1)
    expect(wrapper.findAll('[data-row-kind="attachment"]')).toHaveLength(1)
  })

  it('disables Save when an attachment URL is invalid', async () => {
    const wrapper = mountEditor(SendMessageEditor, { node: baseNode })
    const urlInput = wrapper.find('[data-row-kind="attachment"] input[type="url"]')
    await urlInput.setValue('not-a-url')
    const save = wrapper.find('button[type="submit"]')
    expect(save.attributes('disabled')).toBeDefined()
  })

  it('shows the attachment URL error on blur', async () => {
    const wrapper = mountEditor(SendMessageEditor, { node: baseNode })
    const urlInput = wrapper.find('[data-row-kind="attachment"] input[type="url"]')
    await urlInput.setValue('not-a-url')
    await urlInput.trigger('blur')
    expect(wrapper.find('[data-testid="attachment-error-1"]').exists()).toBe(true)
  })

  it('submits a payload preserving row order and types', async () => {
    const wrapper = mountEditor(SendMessageEditor, { node: baseNode })
    await wrapper.find('#sm-name').setValue('Renamed')

    await wrapper.find('form').trigger('submit.prevent')

    expect(mutateAsyncMock()).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'm1',
        patch: {
          name: 'Renamed',
          data: {
            payload: [
              { type: 'text', text: 'Hello' },
              { type: 'attachment', attachment: 'https://example.com/a.png' },
            ],
          },
        },
      }),
    )
    expect(wrapper.emitted('saved')).toBeTruthy()
  })

  it('adds a new text row when the Text button is clicked', async () => {
    const wrapper = mountEditor(SendMessageEditor, { node: baseNode })
    const buttons = wrapper.findAll('button[type="button"]')
    const addText = buttons.find((b) => b.text().includes('Text'))
    if (addText == null) throw new Error('Text add-button not found')
    await addText.trigger('click')
    expect(wrapper.findAll('[data-row-kind="text"]')).toHaveLength(2)
  })

  it('removes a row when its trash button is clicked', async () => {
    const wrapper = mountEditor(SendMessageEditor, { node: baseNode })
    const removeButtons = wrapper.findAll('button[aria-label^="Remove row"]')
    expect(removeButtons.length).toBe(2)
    await removeButtons[0]!.trigger('click')
    expect(wrapper.findAll('[data-row-index]').length).toBe(1)
  })

  it('does not submit when invalid and surfaces the error', async () => {
    const wrapper = mountEditor(SendMessageEditor, { node: baseNode })
    const urlInput = wrapper.find('[data-row-kind="attachment"] input[type="url"]')
    await urlInput.setValue('bad')
    await wrapper.find('form').trigger('submit.prevent')
    expect(mutateAsyncMock()).not.toHaveBeenCalled()
    expect(wrapper.find('[data-testid="attachment-error-1"]').exists()).toBe(true)
  })
})
