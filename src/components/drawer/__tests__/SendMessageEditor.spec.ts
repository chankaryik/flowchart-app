import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { SendMessageNode } from '@/lib/types'
import { useAttachmentsStore } from '@/stores/attachments'
import { flushValidation, makeUpdateNodeMock, mountEditor } from './helpers'

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

beforeEach(() => {
  updateNodeMock = makeUpdateNodeMock()
})

describe('SendMessageEditor', () => {
  it('blocks submit when an attachment row has no file', async () => {
    const wrapper = mountEditor(SendMessageEditor, { node: baseNode })
    await wrapper.find('[data-row-kind="attachment"] [data-testid="attachment-clear"]').trigger('click')
    await flushValidation()
    await wrapper.find('form').trigger('submit')
    await flushValidation()

    expect(updateNodeMock.mutateAsync).not.toHaveBeenCalled()
    expect(wrapper.find('[data-testid="attachment-error-1"]').exists()).toBe(true)
  })

  it('submits the payload in row order with names trimmed', async () => {
    const wrapper = mountEditor(SendMessageEditor, { node: baseNode })
    await wrapper.find('#sm-name').setValue('Renamed')
    await flushValidation()
    await wrapper.find('form').trigger('submit')
    await flushValidation()

    expect(updateNodeMock.mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'm1',
        patch: {
          name: 'Renamed',
          description: undefined,
          data: {
            payload: [
              { type: 'text', text: 'Hello' },
              { type: 'attachment', attachments: ['photo.png'] },
            ],
          },
        },
      }),
    )
  })

  it('persists a trimmed description in the patch when present', async () => {
    const wrapper = mountEditor(SendMessageEditor, { node: baseNode })
    await wrapper.find('[data-testid="sm-description"]').setValue('  greet customer  ')
    await flushValidation()
    await wrapper.find('form').trigger('submit')
    await flushValidation()

    expect(updateNodeMock.mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        patch: expect.objectContaining({ description: 'greet customer' }),
      }),
    )
  })

  it('commits uploaded files to the attachments store on save', async () => {
    const wrapper = mountEditor(SendMessageEditor, { node: baseNode })
    const field = wrapper.findComponent({ name: 'AttachmentField' })
    const fakeFile = new File(['hi'], 'kitten.png', { type: 'image/png' })
    field.vm.$emit('update:files', [fakeFile])
    field.vm.$emit('update:modelValue', ['kitten.png'])
    await flushValidation()
    await wrapper.find('form').trigger('submit')
    await flushValidation()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pinia = (wrapper.vm as any).$.appContext.config.globalProperties.$pinia
    setActivePinia(pinia)
    expect(useAttachmentsStore().get('m1', 1)).toEqual([fakeFile])
  })
})
