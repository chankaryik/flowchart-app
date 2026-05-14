import * as v from 'valibot'

import { DAYS, type BusinessHoursRow } from '@/lib/types'

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/

export const titleSchema = v.pipe(
  v.string(),
  v.transform((value) => value.trim()),
  v.minLength(1, 'Title is required.'),
  v.maxLength(80, 'Title must be 80 characters or fewer.'),
)

export const descriptionSchema = v.pipe(
  v.string(),
  v.maxLength(500, 'Description must be 500 characters or fewer.'),
)

export const commentSchema = v.pipe(
  v.string(),
  v.maxLength(1000, 'Comment must be 1000 characters or fewer.'),
)

export const attachmentSchema = v.pipe(v.string(), v.minLength(1, 'Please upload a file.'))

export const attachmentsSchema = v.pipe(
  v.array(attachmentSchema),
  v.minLength(1, 'Please upload at least one file.'),
)

const timeStringSchema = v.pipe(
  v.string(),
  v.regex(TIME_PATTERN, 'Times must be in HH:MM 24-hour format.'),
)

export const businessHoursRowSchema = v.pipe(
  v.object({
    day: v.picklist(DAYS),
    startTime: timeStringSchema,
    endTime: timeStringSchema,
    closed: v.optional(v.boolean()),
  }),
  v.check(
    ({ startTime, endTime, closed }) =>
      closed === true || toMinutes(endTime) > toMinutes(startTime),
    'End time must be after start time.',
  ),
)

export const businessHoursSchema = v.pipe(
  v.array(businessHoursRowSchema),
  v.minLength(1, 'At least one time range is required.'),
  v.check((rows) => !hasOverlap(rows), 'Overlapping time ranges within a day.'),
)

export const sendMessageTextRowSchema = v.object({
  type: v.literal('text'),
  text: v.string(),
})

export const sendMessageAttachmentRowSchema = v.object({
  type: v.literal('attachment'),
  attachments: attachmentsSchema,
})

export const sendMessagePayloadItemSchema = v.union([
  sendMessageTextRowSchema,
  sendMessageAttachmentRowSchema,
])

export const sendMessagePayloadSchema = v.array(sendMessagePayloadItemSchema)

export function rangesOverlap(
  a: { startTime: string; endTime: string },
  b: { startTime: string; endTime: string },
): boolean {
  const aStart = toMinutes(a.startTime)
  const aEnd = toMinutes(a.endTime)
  const bStart = toMinutes(b.startTime)
  const bEnd = toMinutes(b.endTime)
  return aStart < bEnd && bStart < aEnd
}

function hasOverlap(rows: BusinessHoursRow[]): boolean {
  const byDay = new Map<string, BusinessHoursRow[]>()
  for (const row of rows) {
    if (row.closed === true) continue
    const existing = byDay.get(row.day) ?? []
    existing.push(row)
    byDay.set(row.day, existing)
  }
  for (const rowsForDay of byDay.values()) {
    for (let i = 0; i < rowsForDay.length; i++) {
      for (let j = i + 1; j < rowsForDay.length; j++) {
        const a = rowsForDay[i]
        const b = rowsForDay[j]
        if (a == null || b == null) continue
        if (rangesOverlap(a, b)) return true
      }
    }
  }
  return false
}

function toMinutes(time: string): number {
  const [hh, mm] = time.split(':')
  return Number(hh) * 60 + Number(mm)
}
