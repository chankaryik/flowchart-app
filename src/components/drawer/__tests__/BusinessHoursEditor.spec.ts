import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { DateTimeNode } from '@/lib/types'
import { makeUpdateNodeMock, mountEditor, type MutateAsyncMock } from './helpers'

let updateNodeMock: ReturnType<typeof makeUpdateNodeMock>

vi.mock('@/queries/nodes', () => ({
  useUpdateNode: () => updateNodeMock,
}))

const { default: BusinessHoursEditor } = await import('../BusinessHoursEditor.vue')

const baseNode: DateTimeNode = {
  id: 'dt',
  parentId: 1,
  type: 'dateTime',
  name: 'Business Hours',
  data: {
    times: [{ day: 'mon', startTime: '09:00', endTime: '17:00' }],
    connectors: ['s', 'f'],
    timezone: 'UTC',
    action: 'businessHours',
  },
}

function mutateAsyncMock(): MutateAsyncMock {
  return updateNodeMock.mutateAsync
}

beforeEach(() => {
  updateNodeMock = makeUpdateNodeMock()
})

describe('BusinessHoursEditor', () => {
  it('seeds the form from the node prop', () => {
    const wrapper = mountEditor(BusinessHoursEditor, { node: baseNode })
    expect(wrapper.find<HTMLInputElement>('#dt-name').element.value).toBe('Business Hours')
    expect(wrapper.findAll('[data-row-index]').length).toBe(1)
  })

  it('shows the action as a read-only field', () => {
    const wrapper = mountEditor(BusinessHoursEditor, { node: baseNode })
    expect(wrapper.find('[data-testid="action-readonly"]').text()).toBe('Business Hours')
  })

  it('submits a patch preserving connectors and action', async () => {
    const wrapper = mountEditor(BusinessHoursEditor, { node: baseNode })
    await wrapper.find('#dt-name').setValue('Updated Hours')
    await wrapper.find('form').trigger('submit.prevent')

    expect(mutateAsyncMock()).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'dt',
        patch: {
          name: 'Updated Hours',
          data: {
            times: [{ day: 'mon', startTime: '09:00', endTime: '17:00' }],
            connectors: ['s', 'f'],
            timezone: 'UTC',
            action: 'businessHours',
          },
        },
      }),
    )
    expect(wrapper.emitted('saved')).toBeTruthy()
  })

  it('refuses to submit and shows a row-overlap error', async () => {
    const overlapping: DateTimeNode = {
      ...baseNode,
      data: {
        ...baseNode.data,
        times: [
          { day: 'mon', startTime: '09:00', endTime: '12:00' },
          { day: 'mon', startTime: '11:00', endTime: '15:00' },
        ],
      },
    }
    const wrapper = mountEditor(BusinessHoursEditor, { node: overlapping })
    await wrapper.find('form').trigger('submit.prevent')
    expect(mutateAsyncMock()).not.toHaveBeenCalled()
    expect(wrapper.find('[data-testid="times-error"]').exists()).toBe(true)
  })

  it('refuses to submit when end-time is before start-time', async () => {
    const inverted: DateTimeNode = {
      ...baseNode,
      data: {
        ...baseNode.data,
        times: [{ day: 'mon', startTime: '17:00', endTime: '09:00' }],
      },
    }
    const wrapper = mountEditor(BusinessHoursEditor, { node: inverted })
    await wrapper.find('form').trigger('submit.prevent')
    expect(mutateAsyncMock()).not.toHaveBeenCalled()
    expect(wrapper.find('[data-testid="times-error"]').text()).toMatch(/End time/i)
  })

  it('adds a new schedule row when the Row button is clicked', async () => {
    const wrapper = mountEditor(BusinessHoursEditor, { node: baseNode })
    const addBtn = wrapper
      .findAll('button[type="button"]')
      .find((b) => b.text().includes('Row'))
    if (addBtn == null) throw new Error('Row add-button not found')
    await addBtn.trigger('click')
    expect(wrapper.findAll('[data-row-index]').length).toBe(2)
  })

  it('removes a row when the trash button is clicked', async () => {
    const wrapper = mountEditor(BusinessHoursEditor, { node: baseNode })
    const removeBtn = wrapper.find('button[aria-label="Remove row 1"]')
    await removeBtn.trigger('click')
    expect(wrapper.findAll('[data-row-index]').length).toBe(0)
  })
})
