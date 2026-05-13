import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { SendMessageNode } from '@/lib/types'
import { useAttachmentsStore } from '@/stores/attachments'
import { flushValidation, makeUpdateNodeMock, mountEditor, type MutateAsyncMock } from './helpers'

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
      { type: 'attachment', attachments: ['photo.png'] },
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

  it('shows the attachment preview with the filename when a row has an attachment', () => {
    const wrapper = mountEditor(SendMessageEditor, { node: baseNode })
    const preview = wrapper.find('[data-row-kind="attachment"] [data-testid="attachment-preview"]')
    expect(preview.exists()).toBe(true)
    expect(preview.text()).toContain('photo.png')
  })

  it('disables Save when an attachment is cleared', async () => {
    const wrapper = mountEditor(SendMessageEditor, { node: baseNode })
    const clear = wrapper.find('[data-row-kind="attachment"] [data-testid="attachment-clear"]')
    await clear.trigger('click')
    await flushValidation()
    const save = wrapper.find('button[type="submit"]')
    expect(save.attributes('disabled')).toBeDefined()
  })

  it('surfaces an attachment error when a row has no file', async () => {
    const wrapper = mountEditor(SendMessageEditor, { node: baseNode })
    const clear = wrapper.find('[data-row-kind="attachment"] [data-testid="attachment-clear"]')
    await clear.trigger('click')
    await flushValidation()
    await wrapper.find('form').trigger('submit')
    await flushValidation()
    expect(wrapper.find('[data-testid="attachment-error-1"]').exists()).toBe(true)
  })

  it('submits a payload preserving row order and types', async () => {
    const wrapper = mountEditor(SendMessageEditor, { node: baseNode })
    await wrapper.find('#sm-name').setValue('Renamed')
    await flushValidation()
    await wrapper.find('form').trigger('submit')
    await flushValidation()

    expect(mutateAsyncMock()).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'm1',
        patch: {
          name: 'Renamed',
          data: {
            payload: [
              { type: 'text', text: 'Hello' },
              { type: 'attachment', attachments: ['photo.png'] },
            ],
          },
        },
      }),
    )
    expect(wrapper.emitted('saved')).toBeTruthy()
  })

  it('disables the Text add-button when a text row already exists', () => {
    const wrapper = mountEditor(SendMessageEditor, { node: baseNode })
    const buttons = wrapper.findAll('button[type="button"]')
    const addText = buttons.find((b) => b.text().includes('Text'))
    if (addText == null) throw new Error('Text add-button not found')
    expect(addText.attributes('disabled')).toBeDefined()
  })

  it('disables the Attachment add-button when an attachment row already exists', () => {
    const wrapper = mountEditor(SendMessageEditor, { node: baseNode })
    const buttons = wrapper.findAll('button[type="button"]')
    const addAttachment = buttons.find((b) => b.text().includes('Attachment'))
    if (addAttachment == null) throw new Error('Attachment add-button not found')
    expect(addAttachment.attributes('disabled')).toBeDefined()
  })

  it('shows the dropzone for a freshly added attachment row', async () => {
    const node: SendMessageNode = {
      ...baseNode,
      data: { payload: [{ type: 'text', text: 'Hello' }] },
    }
    const wrapper = mountEditor(SendMessageEditor, { node })
    const buttons = wrapper.findAll('button[type="button"]')
    const addAttachment = buttons.find((b) => b.text().includes('Attachment'))
    if (addAttachment == null) throw new Error('Attachment add-button not found')
    await addAttachment.trigger('click')
    expect(wrapper.findAll('[data-row-kind="attachment"]')).toHaveLength(1)
    const newRow = wrapper.find('[data-row-kind="attachment"]')
    expect(newRow.find('[data-testid="attachment-dropzone"]').exists()).toBe(true)
  })

  it('commits uploaded files to the attachments store on save and hydrates on remount', async () => {
    const wrapper = mountEditor(SendMessageEditor, { node: baseNode })
    // Simulate the AttachmentField emitting an upload for the existing row.
    const field = wrapper.findComponent({ name: 'AttachmentField' })
    const fakeFile = new File(['hi'], 'kitten.png', { type: 'image/png' })
    field.vm.$emit('update:files', [fakeFile])
    field.vm.$emit('update:modelValue', ['kitten.png'])
    await flushValidation()
    await wrapper.find('form').trigger('submit')
    await flushValidation()

    // The mutation was called with the new filename.
    expect(mutateAsyncMock()).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'm1',
        patch: expect.objectContaining({
          data: {
            payload: [
              { type: 'text', text: 'Hello' },
              { type: 'attachment', attachments: ['kitten.png'] },
            ],
          },
        }),
      }),
    )

    // The store now owns the File at the saved index.
    // The mountEditor helper used its own pinia plugin, so we activate it
    // again via the wrapper's app to read the same store instance.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pinia = (wrapper.vm as any).$.appContext.config.globalProperties.$pinia
    setActivePinia(pinia)
    const store = useAttachmentsStore()
    expect(store.get('m1', 1)).toEqual([fakeFile])
  })

  it('does not immediately surface a validation error when an attachment row is added', async () => {
    const node: SendMessageNode = {
      ...baseNode,
      data: { payload: [{ type: 'text', text: 'Hello' }] },
    }
    const wrapper = mountEditor(SendMessageEditor, { node })
    const buttons = wrapper.findAll('button[type="button"]')
    const addAttachment = buttons.find((b) => b.text().includes('Attachment'))
    if (addAttachment == null) throw new Error('Attachment add-button not found')
    await addAttachment.trigger('click')
    await flushValidation()
    // The fresh row at index 1 is invalid (empty attachments array) but the
    // user hasn't touched it yet — no error message should be visible.
    expect(wrapper.find('[data-testid="attachment-error-1"]').exists()).toBe(false)
    // Submit must still be blocked because the form is technically invalid.
    const save = wrapper.find('button[type="submit"]')
    expect(save.attributes('disabled')).toBeDefined()
  })

  it('does not flash a validation error when the dropzone is clicked', async () => {
    const node: SendMessageNode = {
      ...baseNode,
      data: { payload: [{ type: 'text', text: 'Hello' }] },
    }
    const wrapper = mountEditor(SendMessageEditor, { node })
    const buttons = wrapper.findAll('button[type="button"]')
    const addAttachment = buttons.find((b) => b.text().includes('Attachment'))
    if (addAttachment == null) throw new Error('Attachment add-button not found')
    await addAttachment.trigger('click')
    await flushValidation()
    const dropzone = wrapper.find('[data-testid="attachment-dropzone"]')
    await dropzone.trigger('click')
    await flushValidation()
    expect(wrapper.find('[data-testid="attachment-error-1"]').exists()).toBe(false)
  })

  it('removes a row when its trash button is clicked', async () => {
    const wrapper = mountEditor(SendMessageEditor, { node: baseNode })
    const removeButtons = wrapper.findAll('button[aria-label^="Remove row"]')
    expect(removeButtons.length).toBe(2)
    await removeButtons[0]!.trigger('click')
    expect(wrapper.findAll('[data-row-index]').length).toBe(1)
  })
})
