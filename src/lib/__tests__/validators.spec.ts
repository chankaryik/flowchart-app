import { describe, expect, it } from 'vitest'
import * as v from 'valibot'

import {
  attachmentSchema,
  businessHoursSchema,
  businessHoursRowSchema,
  commentSchema,
  descriptionSchema,
  rangesOverlap,
  titleSchema,
} from '@/lib/validators'

function ok<T>(schema: v.GenericSchema<T> | v.GenericSchema<unknown>, value: unknown): boolean {
  return v.safeParse(schema, value).success
}

describe('titleSchema', () => {
  it('rejects empty and whitespace-only values', () => {
    expect(ok(titleSchema, '')).toBe(false)
    expect(ok(titleSchema, '   ')).toBe(false)
  })

  it('accepts 1–80 characters', () => {
    expect(ok(titleSchema, 'A')).toBe(true)
    expect(ok(titleSchema, 'x'.repeat(80))).toBe(true)
  })

  it('rejects strings longer than 80 characters', () => {
    expect(ok(titleSchema, 'x'.repeat(81))).toBe(false)
  })
})

describe('descriptionSchema', () => {
  it('accepts empty and 500-char values', () => {
    expect(ok(descriptionSchema, '')).toBe(true)
    expect(ok(descriptionSchema, 'x'.repeat(500))).toBe(true)
  })

  it('rejects strings over 500 characters', () => {
    expect(ok(descriptionSchema, 'x'.repeat(501))).toBe(false)
  })
})

describe('attachmentSchema', () => {
  it('rejects empty input', () => {
    expect(ok(attachmentSchema, '')).toBe(false)
  })

  it('accepts any non-empty filename', () => {
    expect(ok(attachmentSchema, 'photo.png')).toBe(true)
    expect(ok(attachmentSchema, 'document.pdf')).toBe(true)
  })
})

describe('commentSchema', () => {
  it('accepts up to 1000 characters', () => {
    expect(ok(commentSchema, '')).toBe(true)
    expect(ok(commentSchema, 'x'.repeat(1000))).toBe(true)
  })

  it('rejects strings longer than 1000 characters', () => {
    expect(ok(commentSchema, 'x'.repeat(1001))).toBe(false)
  })
})

describe('businessHoursRowSchema', () => {
  it('accepts end > start', () => {
    expect(ok(businessHoursRowSchema, { day: 'mon', startTime: '09:00', endTime: '17:00' })).toBe(
      true,
    )
  })

  it('rejects equal start and end', () => {
    expect(ok(businessHoursRowSchema, { day: 'mon', startTime: '09:00', endTime: '09:00' })).toBe(
      false,
    )
  })

  it('rejects end before start', () => {
    expect(ok(businessHoursRowSchema, { day: 'mon', startTime: '17:00', endTime: '09:00' })).toBe(
      false,
    )
  })

  it('rejects malformed times', () => {
    expect(ok(businessHoursRowSchema, { day: 'mon', startTime: '9:00', endTime: '17:00' })).toBe(
      false,
    )
    expect(ok(businessHoursRowSchema, { day: 'mon', startTime: '25:00', endTime: '17:00' })).toBe(
      false,
    )
    expect(ok(businessHoursRowSchema, { day: 'mon', startTime: '09:60', endTime: '17:00' })).toBe(
      false,
    )
  })

  it('skips end>start check when the row is marked closed', () => {
    expect(
      ok(businessHoursRowSchema, {
        day: 'mon',
        startTime: '17:00',
        endTime: '09:00',
        closed: true,
      }),
    ).toBe(true)
  })
})

describe('rangesOverlap', () => {
  it('detects overlapping ranges', () => {
    expect(
      rangesOverlap(
        { startTime: '09:00', endTime: '12:00' },
        { startTime: '11:00', endTime: '13:00' },
      ),
    ).toBe(true)
  })

  it('treats touching boundaries as non-overlapping', () => {
    expect(
      rangesOverlap(
        { startTime: '09:00', endTime: '12:00' },
        { startTime: '12:00', endTime: '13:00' },
      ),
    ).toBe(false)
  })

  it('detects fully contained ranges', () => {
    expect(
      rangesOverlap(
        { startTime: '09:00', endTime: '17:00' },
        { startTime: '10:00', endTime: '11:00' },
      ),
    ).toBe(true)
  })
})

describe('businessHoursSchema', () => {
  it('rejects empty list', () => {
    expect(ok(businessHoursSchema, [])).toBe(false)
  })

  it('accepts single valid row', () => {
    expect(ok(businessHoursSchema, [{ day: 'mon', startTime: '09:00', endTime: '17:00' }])).toBe(
      true,
    )
  })

  it('accepts the seed payload (mon–sun 09:00–17:00)', () => {
    const days = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const
    const rows = days.map((day) => ({ day, startTime: '09:00', endTime: '17:00' }))
    expect(ok(businessHoursSchema, rows)).toBe(true)
  })

  it('rejects rows whose end is not after start', () => {
    expect(ok(businessHoursSchema, [{ day: 'mon', startTime: '17:00', endTime: '09:00' }])).toBe(
      false,
    )
  })

  it('allows repeated days when ranges do not overlap', () => {
    expect(
      ok(businessHoursSchema, [
        { day: 'mon', startTime: '09:00', endTime: '12:00' },
        { day: 'mon', startTime: '13:00', endTime: '17:00' },
      ]),
    ).toBe(true)
  })

  it('rejects overlapping ranges within the same day', () => {
    expect(
      ok(businessHoursSchema, [
        { day: 'mon', startTime: '09:00', endTime: '12:00' },
        { day: 'mon', startTime: '11:00', endTime: '13:00' },
      ]),
    ).toBe(false)
  })

  it('treats touching ranges within a day as non-overlapping', () => {
    expect(
      ok(businessHoursSchema, [
        { day: 'mon', startTime: '09:00', endTime: '12:00' },
        { day: 'mon', startTime: '12:00', endTime: '17:00' },
      ]),
    ).toBe(true)
  })
})
