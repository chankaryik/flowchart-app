import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { AddCommentNode } from '@/lib/types'
import { flushValidation, makeUpdateNodeMock, mountEditor } from './helpers'

let updateNodeMock: ReturnType<typeof makeUpdateNodeMock>

vi.mock('@/queries/nodes', () => ({
  useUpdateNode: () => updateNodeMock,
}))

const { default: AddCommentEditor } = await import('../AddCommentEditor.vue')

const baseNode: AddCommentNode = {
  id: 'c1',
  parentId: 'm1',
  type: 'addComment',
  name: 'After-hours note',
  data: { comment: 'Original comment' },
}

beforeEach(() => {
  updateNodeMock = makeUpdateNodeMock()
})

describe('AddCommentEditor', () => {
  it('refuses to submit when the title is empty and never calls the mutation', async () => {
    const wrapper = mountEditor(AddCommentEditor, { node: baseNode })
    await wrapper.find('#comment-name').setValue('')
    await flushValidation()
    await wrapper.find('form').trigger('submit')
    await flushValidation()

    expect(updateNodeMock.mutateAsync).not.toHaveBeenCalled()
    expect(wrapper.find('[data-testid="title-error"]').exists()).toBe(true)
  })

  it('submits a trimmed name + comment patch on save', async () => {
    const wrapper = mountEditor(AddCommentEditor, { node: baseNode })
    await wrapper.find('#comment-name').setValue('  Renamed  ')
    await wrapper.find('#comment-body').setValue('Updated body')
    await flushValidation()
    await wrapper.find('form').trigger('submit')
    await flushValidation()

    expect(updateNodeMock.mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'c1',
        patch: { name: 'Renamed', description: undefined, data: { comment: 'Updated body' } },
      }),
    )
  })

  it('persists a trimmed description in the patch when present', async () => {
    const wrapper = mountEditor(AddCommentEditor, { node: baseNode })
    await wrapper.find('[data-testid="comment-description"]').setValue('  internal note  ')
    await flushValidation()
    await wrapper.find('form').trigger('submit')
    await flushValidation()

    expect(updateNodeMock.mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        patch: expect.objectContaining({ description: 'internal note' }),
      }),
    )
  })
})
