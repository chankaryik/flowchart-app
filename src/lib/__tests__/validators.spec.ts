import { describe, expect, it } from 'vitest'

import {
  rangesOverlap,
  validateAttachmentUrl,
  validateBusinessHours,
  validateComment,
  validateDescription,
  validateTimeRange,
  validateTitle,
} from '@/lib/validators'

describe('validateTitle', () => {
  it('rejects empty and whitespace-only values', () => {
    expect(validateTitle('').ok).toBe(false)
    expect(validateTitle('   ').ok).toBe(false)
  })

  it('accepts 1–80 characters', () => {
    expect(validateTitle('A').ok).toBe(true)
    expect(validateTitle('x'.repeat(80)).ok).toBe(true)
  })

  it('rejects strings longer than 80 characters', () => {
    expect(validateTitle('x'.repeat(81)).ok).toBe(false)
  })
})

describe('validateDescription', () => {
  it('accepts empty and 500-char values', () => {
    expect(validateDescription('').ok).toBe(true)
    expect(validateDescription('x'.repeat(500)).ok).toBe(true)
  })

  it('rejects strings over 500 characters', () => {
    expect(validateDescription('x'.repeat(501)).ok).toBe(false)
  })
})

describe('validateAttachmentUrl', () => {
  it('accepts well-formed URLs', () => {
    expect(validateAttachmentUrl('https://example.com/file.png').ok).toBe(true)
    expect(validateAttachmentUrl('http://localhost:3000/x').ok).toBe(true)
  })

  it('rejects empty input', () => {
    expect(validateAttachmentUrl('').ok).toBe(false)
    expect(validateAttachmentUrl('   ').ok).toBe(false)
  })

  it('rejects malformed URLs', () => {
    expect(validateAttachmentUrl('not a url').ok).toBe(false)
    expect(validateAttachmentUrl('://broken').ok).toBe(false)
  })
})

describe('validateComment', () => {
  it('accepts up to 1000 characters', () => {
    expect(validateComment('').ok).toBe(true)
    expect(validateComment('x'.repeat(1000)).ok).toBe(true)
  })

  it('rejects strings longer than 1000 characters', () => {
    expect(validateComment('x'.repeat(1001)).ok).toBe(false)
  })
})

describe('validateTimeRange', () => {
  it('accepts end > start', () => {
    expect(validateTimeRange('09:00', '17:00').ok).toBe(true)
  })

  it('rejects equal start and end', () => {
    expect(validateTimeRange('09:00', '09:00').ok).toBe(false)
  })

  it('rejects end before start', () => {
    expect(validateTimeRange('17:00', '09:00').ok).toBe(false)
  })

  it('rejects malformed times', () => {
    expect(validateTimeRange('9:00', '17:00').ok).toBe(false)
    expect(validateTimeRange('25:00', '17:00').ok).toBe(false)
    expect(validateTimeRange('09:60', '17:00').ok).toBe(false)
  })
})

describe('rangesOverlap', () => {
  it('detects overlapping ranges', () => {
    expect(rangesOverlap({ startTime: '09:00', endTime: '12:00' }, { startTime: '11:00', endTime: '13:00' })).toBe(true)
  })

  it('treats touching boundaries as non-overlapping', () => {
    expect(rangesOverlap({ startTime: '09:00', endTime: '12:00' }, { startTime: '12:00', endTime: '13:00' })).toBe(false)
  })

  it('detects fully contained ranges', () => {
    expect(rangesOverlap({ startTime: '09:00', endTime: '17:00' }, { startTime: '10:00', endTime: '11:00' })).toBe(true)
  })
})

describe('validateBusinessHours', () => {
  it('rejects empty list', () => {
    expect(validateBusinessHours([]).ok).toBe(false)
  })

  it('accepts single valid row', () => {
    expect(validateBusinessHours([{ day: 'mon', startTime: '09:00', endTime: '17:00' }]).ok).toBe(true)
  })

  it('accepts the seed payload (mon–sun 09:00–17:00)', () => {
    const days = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const
    const rows = days.map((day) => ({ day, startTime: '09:00', endTime: '17:00' }))
    expect(validateBusinessHours(rows).ok).toBe(true)
  })

  it('rejects rows whose end is not after start', () => {
    expect(validateBusinessHours([{ day: 'mon', startTime: '17:00', endTime: '09:00' }]).ok).toBe(false)
  })

  it('allows repeated days when ranges do not overlap', () => {
    expect(
      validateBusinessHours([
        { day: 'mon', startTime: '09:00', endTime: '12:00' },
        { day: 'mon', startTime: '13:00', endTime: '17:00' },
      ]).ok,
    ).toBe(true)
  })

  it('rejects overlapping ranges within the same day', () => {
    expect(
      validateBusinessHours([
        { day: 'mon', startTime: '09:00', endTime: '12:00' },
        { day: 'mon', startTime: '11:00', endTime: '13:00' },
      ]).ok,
    ).toBe(false)
  })

  it('treats touching ranges within a day as non-overlapping', () => {
    expect(
      validateBusinessHours([
        { day: 'mon', startTime: '09:00', endTime: '12:00' },
        { day: 'mon', startTime: '12:00', endTime: '17:00' },
      ]).ok,
    ).toBe(true)
  })
})
