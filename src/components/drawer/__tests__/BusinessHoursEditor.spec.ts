import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { DateTimeNode } from '@/lib/types'
import { flushValidation, makeUpdateNodeMock, mountEditor } from './helpers'

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

beforeEach(() => {
  updateNodeMock = makeUpdateNodeMock()
})

describe('BusinessHoursEditor — validation gates', () => {
  it('refuses to submit when two ranges overlap on the same day', async () => {
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
    await wrapper.find('form').trigger('submit')
    await flushValidation()

    expect(updateNodeMock.mutateAsync).not.toHaveBeenCalled()
    expect(wrapper.find('[data-testid="times-error"]').exists()).toBe(true)
  })

  it('refuses to submit when end-time precedes start-time', async () => {
    const inverted: DateTimeNode = {
      ...baseNode,
      data: { ...baseNode.data, times: [{ day: 'mon', startTime: '17:00', endTime: '09:00' }] },
    }
    const wrapper = mountEditor(BusinessHoursEditor, { node: inverted })
    await wrapper.find('form').trigger('submit')
    await flushValidation()

    expect(updateNodeMock.mutateAsync).not.toHaveBeenCalled()
    expect(wrapper.find('[data-testid="times-error"]').text()).toMatch(/End time/i)
  })

  it('preserves connectors/timezone/action through the submitted patch', async () => {
    const wrapper = mountEditor(BusinessHoursEditor, { node: baseNode })
    await wrapper.find('#dt-name').setValue('Updated Hours')
    await flushValidation()
    await wrapper.find('form').trigger('submit')
    await flushValidation()

    expect(updateNodeMock.mutateAsync).toHaveBeenCalledWith(
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
  })
})
