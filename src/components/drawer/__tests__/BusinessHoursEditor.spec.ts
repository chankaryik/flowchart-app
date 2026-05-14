import { beforeEach, describe, expect, it, vi } from 'vitest'

import { DAYS, type BusinessHoursRow, type DateTimeNode } from '@/lib/types'
import { flushValidation, makeUpdateNodeMock, mountEditor } from './helpers'

let updateNodeMock: ReturnType<typeof makeUpdateNodeMock>

vi.mock('@/queries/nodes', () => ({
  useUpdateNode: () => updateNodeMock,
}))

const { default: BusinessHoursEditor } = await import('../BusinessHoursEditor.vue')

function fullWeek(): BusinessHoursRow[] {
  return DAYS.map((day) => ({ day, startTime: '09:00', endTime: '17:00' }))
}

const baseNode: DateTimeNode = {
  id: 'dt',
  parentId: 1,
  type: 'dateTime',
  name: 'Business Hours',
  data: {
    times: fullWeek(),
    connectors: ['s', 'f'],
    timezone: 'UTC',
    action: 'businessHours',
  },
}

beforeEach(() => {
  updateNodeMock = makeUpdateNodeMock()
})

describe('BusinessHoursEditor — schedule UI shape', () => {
  it('always renders one row per day in Mon→Sun order, even when seed data is incomplete', () => {
    const sparse: DateTimeNode = {
      ...baseNode,
      data: { ...baseNode.data, times: [{ day: 'wed', startTime: '08:00', endTime: '12:00' }] },
    }
    const wrapper = mountEditor(BusinessHoursEditor, { node: sparse })
    const rows = wrapper.findAll('[data-day]')
    expect(rows).toHaveLength(7)
    expect(rows.map((r) => r.attributes('data-day'))).toEqual([...DAYS])
  })

  it('disables time inputs for a row marked closed', () => {
    const seed: DateTimeNode = {
      ...baseNode,
      data: {
        ...baseNode.data,
        times: DAYS.map((day) =>
          day === 'sun'
            ? { day, startTime: '09:00', endTime: '17:00', closed: true }
            : { day, startTime: '09:00', endTime: '17:00' },
        ),
      },
    }
    const wrapper = mountEditor(BusinessHoursEditor, { node: seed })
    const sundayRow = wrapper.find('[data-day="sun"]')
    const inputs = sundayRow.findAll('input[type="time"]')
    expect(inputs).toHaveLength(2)
    for (const input of inputs) {
      expect(input.attributes('disabled')).toBeDefined()
    }
  })
})

describe('BusinessHoursEditor — validation gates', () => {
  it('refuses to submit when end-time precedes start-time on an open day', async () => {
    const inverted: DateTimeNode = {
      ...baseNode,
      data: {
        ...baseNode.data,
        times: DAYS.map((day) =>
          day === 'mon'
            ? { day, startTime: '17:00', endTime: '09:00' }
            : { day, startTime: '09:00', endTime: '17:00' },
        ),
      },
    }
    const wrapper = mountEditor(BusinessHoursEditor, { node: inverted })
    await wrapper.find('form').trigger('submit')
    await flushValidation()

    expect(updateNodeMock.mutateAsync).not.toHaveBeenCalled()
    expect(wrapper.find('[data-testid="times-error"]').text()).toMatch(/End time/i)
  })

  it('skips end>start validation for rows marked closed', async () => {
    const closedInverted: DateTimeNode = {
      ...baseNode,
      data: {
        ...baseNode.data,
        times: DAYS.map((day) =>
          day === 'mon'
            ? { day, startTime: '17:00', endTime: '09:00', closed: true }
            : { day, startTime: '09:00', endTime: '17:00' },
        ),
      },
    }
    const wrapper = mountEditor(BusinessHoursEditor, { node: closedInverted })
    await wrapper.find('form').trigger('submit')
    await flushValidation()

    expect(updateNodeMock.mutateAsync).toHaveBeenCalled()
  })
})

describe('BusinessHoursEditor — submitted patch', () => {
  it('preserves connectors/timezone/action and writes 7 normalised rows', async () => {
    const wrapper = mountEditor(BusinessHoursEditor, { node: baseNode })
    await wrapper.find('#dt-name').setValue('Updated Hours')
    await flushValidation()
    await wrapper.find('form').trigger('submit')
    await flushValidation()

    expect(updateNodeMock.mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'dt',
        patch: expect.objectContaining({
          name: 'Updated Hours',
          description: undefined,
          data: expect.objectContaining({
            connectors: ['s', 'f'],
            timezone: 'UTC',
            action: 'businessHours',
            times: fullWeek(),
          }),
        }),
      }),
    )
  })

  it('persists a trimmed description in the patch when present', async () => {
    const wrapper = mountEditor(BusinessHoursEditor, { node: baseNode })
    await wrapper.find('[data-testid="dt-description"]').setValue('  office hours  ')
    await flushValidation()
    await wrapper.find('form').trigger('submit')
    await flushValidation()

    expect(updateNodeMock.mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        patch: expect.objectContaining({ description: 'office hours' }),
      }),
    )
  })
})
