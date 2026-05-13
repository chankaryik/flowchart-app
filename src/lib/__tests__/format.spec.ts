import { describe, expect, it } from 'vitest'

import {
  attachmentCount,
  dayLabel,
  firstTextPreview,
  humanizeKey,
  summarizeBusinessHours,
} from '@/lib/format'

describe('humanizeKey', () => {
  it('splits camelCase into Title Case words', () => {
    expect(humanizeKey('conversationOpened')).toBe('Conversation Opened')
    expect(humanizeKey('businessHours')).toBe('Business Hours')
  })

  it('handles single words and separator characters', () => {
    expect(humanizeKey('trigger')).toBe('Trigger')
    expect(humanizeKey('snake_case_value')).toBe('Snake Case Value')
    expect(humanizeKey('kebab-case-value')).toBe('Kebab Case Value')
  })

  it('returns empty string for empty input', () => {
    expect(humanizeKey('')).toBe('')
  })
})

describe('summarizeBusinessHours', () => {
  it('collapses a full week of identical hours into a Daily summary', () => {
    const week = (['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const).map((day) => ({
      day,
      startTime: '09:00',
      endTime: '17:00',
    }))
    expect(summarizeBusinessHours(week, 'UTC')).toBe('Daily 09:00–17:00 (UTC)')
  })

  it('uses a single-day summary when only one row is present', () => {
    expect(
      summarizeBusinessHours([{ day: 'mon', startTime: '08:00', endTime: '12:00' }], 'UTC'),
    ).toBe('Mon 08:00–12:00 (UTC)')
  })

  it('uses a count summary when multiple days share the same range but not all 7', () => {
    expect(
      summarizeBusinessHours(
        [
          { day: 'mon', startTime: '09:00', endTime: '17:00' },
          { day: 'tue', startTime: '09:00', endTime: '17:00' },
          { day: 'wed', startTime: '09:00', endTime: '17:00' },
        ],
        'PST',
      ),
    ).toBe('3 days 09:00–17:00 (PST)')
  })

  it('falls back to a row-count summary when ranges differ', () => {
    expect(
      summarizeBusinessHours(
        [
          { day: 'mon', startTime: '09:00', endTime: '17:00' },
          { day: 'tue', startTime: '10:00', endTime: '18:00' },
        ],
        'UTC',
      ),
    ).toBe('2 schedule rows (UTC)')
  })

  it('handles an empty schedule', () => {
    expect(summarizeBusinessHours([], 'UTC')).toBe('No schedule (UTC)')
  })
})

describe('payload helpers', () => {
  it('returns the first text payload text', () => {
    expect(
      firstTextPreview([
        { type: 'attachment', attachments: ['a'] },
        { type: 'text', text: 'hi' },
        { type: 'text', text: 'second' },
      ]),
    ).toBe('hi')
  })

  it('returns an empty string when no text item is present', () => {
    expect(firstTextPreview([{ type: 'attachment', attachments: ['a'] }])).toBe('')
    expect(firstTextPreview([])).toBe('')
  })

  it('counts files across all attachment items', () => {
    expect(
      attachmentCount([
        { type: 'text', text: 'a' },
        { type: 'attachment', attachments: ['x', 'y'] },
        { type: 'attachment', attachments: ['z'] },
      ]),
    ).toBe(3)
    expect(attachmentCount([])).toBe(0)
  })
})

describe('dayLabel', () => {
  it('maps each Day to its three-letter capitalized label', () => {
    expect(dayLabel('mon')).toBe('Mon')
    expect(dayLabel('sun')).toBe('Sun')
  })
})
