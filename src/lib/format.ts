import type { BusinessHoursRow, Day, SendMessagePayloadItem } from '@/lib/types'

const DAY_LABEL: Record<Day, string> = {
  mon: 'Mon',
  tue: 'Tue',
  wed: 'Wed',
  thu: 'Thu',
  fri: 'Fri',
  sat: 'Sat',
  sun: 'Sun',
}

export function humanizeKey(value: string): string {
  if (value.length === 0) return ''
  const spaced = value.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ')
  return spaced
    .split(' ')
    .filter((part) => part.length > 0)
    .map((part) => part[0]!.toUpperCase() + part.slice(1))
    .join(' ')
}

export function dayLabel(day: Day): string {
  return DAY_LABEL[day]
}

export function summarizeBusinessHours(times: BusinessHoursRow[], timezone: string): string {
  if (times.length === 0) return `No schedule (${timezone})`
  const first = times[0]
  if (first == null) return `No schedule (${timezone})`

  const allSame = times.every(
    (row) => row.startTime === first.startTime && row.endTime === first.endTime,
  )
  if (allSame) {
    if (times.length === 7) {
      return `Daily ${first.startTime}–${first.endTime} (${timezone})`
    }
    if (times.length === 1) {
      return `${dayLabel(first.day)} ${first.startTime}–${first.endTime} (${timezone})`
    }
    return `${times.length} days ${first.startTime}–${first.endTime} (${timezone})`
  }
  return `${times.length} schedule rows (${timezone})`
}

export function firstTextPreview(payload: SendMessagePayloadItem[]): string {
  for (const item of payload) {
    if (item.type === 'text') return item.text
  }
  return ''
}

export function attachmentCount(payload: SendMessagePayloadItem[]): number {
  let count = 0
  for (const item of payload) {
    if (item.type === 'attachment') count += 1
  }
  return count
}
