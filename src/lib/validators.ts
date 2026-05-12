import type { BusinessHoursRow, Day, ValidationResult } from '@/lib/types'

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/

export function validateTitle(value: string): ValidationResult {
  const trimmed = value.trim()
  if (trimmed.length === 0) {
    return { ok: false, message: 'Title is required.' }
  }
  if (trimmed.length > 80) {
    return { ok: false, message: 'Title must be 80 characters or fewer.' }
  }
  return { ok: true }
}

export function validateDescription(value: string): ValidationResult {
  if (value.length > 500) {
    return { ok: false, message: 'Description must be 500 characters or fewer.' }
  }
  return { ok: true }
}

export function validateAttachmentUrl(value: string): ValidationResult {
  const trimmed = value.trim()
  if (trimmed.length === 0) {
    return { ok: false, message: 'Attachment URL is required.' }
  }
  try {
     
    new URL(trimmed)
    return { ok: true }
  } catch {
    return { ok: false, message: 'Attachment URL must be a valid URL (e.g. https://example.com/file.png).' }
  }
}

export function validateComment(value: string): ValidationResult {
  if (value.length > 1000) {
    return { ok: false, message: 'Comment must be 1000 characters or fewer.' }
  }
  return { ok: true }
}

export function validateTimeRange(startTime: string, endTime: string): ValidationResult {
  if (!TIME_PATTERN.test(startTime) || !TIME_PATTERN.test(endTime)) {
    return { ok: false, message: 'Times must be in HH:MM 24-hour format.' }
  }
  if (toMinutes(endTime) <= toMinutes(startTime)) {
    return { ok: false, message: 'End time must be after start time.' }
  }
  return { ok: true }
}

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

export function validateBusinessHours(times: BusinessHoursRow[]): ValidationResult {
  if (times.length === 0) {
    return { ok: false, message: 'At least one time range is required.' }
  }

  for (let i = 0; i < times.length; i++) {
    const row = times[i]
    if (row == null) continue
    const rangeResult = validateTimeRange(row.startTime, row.endTime)
    if (!rangeResult.ok) {
      return { ok: false, message: `Row ${i + 1}: ${rangeResult.message}` }
    }
  }

  const byDay = new Map<Day, BusinessHoursRow[]>()
  for (const row of times) {
    const existing = byDay.get(row.day) ?? []
    existing.push(row)
    byDay.set(row.day, existing)
  }

  for (const [day, rows] of byDay) {
    for (let i = 0; i < rows.length; i++) {
      for (let j = i + 1; j < rows.length; j++) {
        const a = rows[i]
        const b = rows[j]
        if (a == null || b == null) continue
        if (rangesOverlap(a, b)) {
          return { ok: false, message: `Overlapping time ranges on ${day}.` }
        }
      }
    }
  }

  return { ok: true }
}

function toMinutes(time: string): number {
  const [hh, mm] = time.split(':')
  return Number(hh) * 60 + Number(mm)
}
