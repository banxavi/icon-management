export const REPORT_TIMEZONE = 'Asia/Saigon'

export type ZonedParts = {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
}

export function zonedParts(date: Date, timeZone = REPORT_TIMEZONE): ZonedParts {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  })
  const parts = Object.fromEntries(fmt.formatToParts(date).map((part) => [part.type, part.value]))
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
  }
}

export function calendarDateInZone(date: Date, timeZone = REPORT_TIMEZONE): string {
  const parts = zonedParts(date, timeZone)
  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`
}

export function shiftCalendarDate(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split('-').map(Number)
  const shifted = new Date(Date.UTC(year, month - 1, day + days))
  return shifted.toISOString().slice(0, 10)
}

export function isRealCalendarDate(isoDate: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return false
  const [year, month, day] = isoDate.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}

/** True through 23:59:59 on reportDate+1 in the org timezone. False from 00:00:00 on reportDate+2. */
export function isReportWindowOpen(reportDate: string, now: Date, timeZone = REPORT_TIMEZONE): boolean {
  if (!isRealCalendarDate(reportDate)) return false
  const [year, month, day] = reportDate.split('-').map(Number)
  const local = zonedParts(now, timeZone)
  const nowEncoded = Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute, local.second)
  const closeEncoded = Date.UTC(year, month - 1, day + 2, 0, 0, 0)
  return nowEncoded < closeEncoded
}

export function openReportDateBounds(now: Date, timeZone = REPORT_TIMEZONE): { min: string; max: string } {
  const today = calendarDateInZone(now, timeZone)
  return { min: shiftCalendarDate(today, -1), max: today }
}

export function weekdayIndex(date: Date, timeZone = REPORT_TIMEZONE): number {
  const short = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short' }).format(date)
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(short)
}

export function weekdaysOfWeek(now: Date, timeZone = REPORT_TIMEZONE): string[] {
  const today = calendarDateInZone(now, timeZone)
  const dow = weekdayIndex(now, timeZone)
  const mondayOffset = dow === 0 ? -6 : 1 - dow
  const monday = shiftCalendarDate(today, mondayOffset)
  return [0, 1, 2, 3, 4].map((offset) => shiftCalendarDate(monday, offset))
}

export function formatLongDate(date: Date, timeZone = REPORT_TIMEZONE): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
}

export function greetingFor(name: string, date: Date, timeZone = REPORT_TIMEZONE): string {
  const hour = zonedParts(date, timeZone).hour
  const hello = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
  const first = name.trim().split(/\s+/).slice(-1)[0] || name
  return `${hello}, ${first}`
}
