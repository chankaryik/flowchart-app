import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { AddCommentNode } from '@/lib/types'
import { makeUpdateNodeMock, mountEditor, type MutateAsyncMock } from './helpers'

let updateNodeMock: ReturnType<typeof makeUpdateNodeMock>

vi.mock('@/queries/nodes', () => ({
  useUpdateNode: () => updateNodeMock,
}))

// Import after the mock so the SFC picks up the mocked module.
const { default: AddCommentEditor } = await import('../AddCommentEditor.vue')

const baseNode: AddCommentNode = {
  id: 'c1',
  parentId: 'm1',
  type: 'addComment',
  name: 'After-hours note',
  data: { comment: 'Original comment' },
}

function mutateAsyncMock(): MutateAsyncMock {
  return updateNodeMock.mutateAsync
}

beforeEach(() => {
  updateNodeMock = makeUpdateNodeMock()
})

describe('AddCommentEditor', () => {
  it('seeds form fields from the node prop', () => {
    const wrapper = mountEditor(AddCommentEditor, { node: baseNode })
    expect(wrapper.find<HTMLInputElement>('#comment-name').element.value).toBe('After-hours note')
    expect(wrapper.find<HTMLTextAreaElement>('#comment-body').element.value).toBe('Original comment')
  })

  it('keeps Save disabled while the title is empty', async () => {
    const wrapper = mountEditor(AddCommentEditor, { node: baseNode })
    await wrapper.find('#comment-name').setValue('')
    const save = wrapper.find('button[type="submit"]')
    expect(save.attributes('disabled')).toBeDefined()
  })

  it('shows the title error on blur', async () => {
    const wrapper = mountEditor(AddCommentEditor, { node: baseNode })
    const nameInput = wrapper.find('#comment-name')
    await nameInput.setValue('')
    await nameInput.trigger('blur')
    expect(wrapper.find('[data-testid="name-error"]').text()).toMatch(/required/i)
  })

  it('submits a patch with the trimmed name and comment', async () => {
    const wrapper = mountEditor(AddCommentEditor, { node: baseNode })
    await wrapper.find('#comment-name').setValue('  Renamed  ')
    await wrapper.find('#comment-body').setValue('Updated body')
    await wrapper.find('form').trigger('submit.prevent')

    expect(mutateAsyncMock()).toHaveBeenCalledTimes(1)
    expect(mutateAsyncMock()).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'c1',
        patch: { name: 'Renamed', data: { comment: 'Updated body' } },
      }),
    )
    expect(wrapper.emitted('saved')).toBeTruthy()
  })

  it('refuses to submit while invalid and never calls the mutation', async () => {
    const wrapper = mountEditor(AddCommentEditor, { node: baseNode })
    await wrapper.find('#comment-name').setValue('')
    await wrapper.find('form').trigger('submit.prevent')
    expect(mutateAsyncMock()).not.toHaveBeenCalled()
    expect(wrapper.emitted('saved')).toBeFalsy()
    // The title error should now be visible because submit was attempted.
    expect(wrapper.find('[data-testid="name-error"]').exists()).toBe(true)
  })
})
