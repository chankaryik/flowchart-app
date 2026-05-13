import { describe, expect, it } from 'vitest'

import DateTimeNode from '../DateTimeNode.vue'
import type { DateTimeNode as DateTimeNodeShape } from '@/lib/types'
import { mountNode } from './helpers'

const fullWeek: DateTimeNodeShape = {
  id: 'dt',
  parentId: 1,
  type: 'dateTime',
  name: 'Business Hours',
  data: {
    times: [
      { day: 'mon', startTime: '09:00', endTime: '17:00' },
      { day: 'tue', startTime: '09:00', endTime: '17:00' },
      { day: 'wed', startTime: '09:00', endTime: '17:00' },
      { day: 'thu', startTime: '09:00', endTime: '17:00' },
      { day: 'fri', startTime: '09:00', endTime: '17:00' },
      { day: 'sat', startTime: '09:00', endTime: '17:00' },
      { day: 'sun', startTime: '09:00', endTime: '17:00' },
    ],
    connectors: ['s', 'f'],
    timezone: 'UTC',
    action: 'businessHours',
  },
}

describe('DateTimeNode', () => {
  it('renders name, action badge and a daily-hours summary', () => {
    const wrapper = mountNode(DateTimeNode, { id: 'dt', data: fullWeek })
    expect(wrapper.text()).toContain('Business Hours')
    expect(wrapper.text()).toContain('Daily 09:00–17:00 (UTC)')

    const badge = wrapper.find('[data-testid="action-badge"]')
    expect(badge.exists()).toBe(true)
    expect(badge.text()).toBe('Business Hours')
  })

  it('falls back to a row-count summary when times disagree', () => {
    const wrapper = mountNode(DateTimeNode, {
      id: 'dt',
      data: {
        ...fullWeek,
        data: {
          ...fullWeek.data,
          times: [
            { day: 'mon', startTime: '09:00', endTime: '17:00' },
            { day: 'tue', startTime: '10:00', endTime: '18:00' },
          ],
        },
      },
    })
    expect(wrapper.text()).toContain('2 schedule rows (UTC)')
  })

  it('exposes target (top) and source (bottom) handles', () => {
    const wrapper = mountNode(DateTimeNode, { id: 'dt', data: fullWeek })
    const handles = wrapper.findAll('[data-testid="handle"]')
    expect(handles).toHaveLength(2)
    const map = Object.fromEntries(
      handles.map((h) => [h.attributes('data-handle-type'), h.attributes('data-handle-position')]),
    )
    expect(map['target']).toBe('top')
    expect(map['source']).toBe('bottom')
  })
})
