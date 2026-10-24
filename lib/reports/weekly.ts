import { messages } from '@/lib/messages'
import { calendarDateInZone, REPORT_TIMEZONE, shiftCalendarDate, weekdayIndex, zonedParts } from '@/lib/reports/window'

export const DEFAULT_WEEKLY_DEADLINE_WEEKDAY = 5
export const DEFAULT_WEEKLY_DEADLINE_TIME = '17:00'
export const WEEKLY_LOOKBACK_WEEKS = 4

export const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const

export type WeeklyInput = {
  weekStart: string
  highlights: string
  progress: string
  risks: string
  nextWeek: string
  intent: 'draft' | 'submit'
}

export type WeeklyFieldErrors = Partial<Record<'weekStart' | 'highlights' | 'progress' | 'risks' | 'nextWeek', string>>

export type DailyDoneRow = {
  reportDate: string
  doneToday: string
}

export function isRealMonday(isoDate: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return false
  const [year, month, day] = isoDate.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day && date.getUTCDay() === 1
}

export function currentWeekStart(now: Date, timeZone = REPORT_TIMEZONE): string {
  const today = calendarDateInZone(now, timeZone)
  const dow = weekdayIndex(now, timeZone)
  const mondayOffset = dow === 0 ? -6 : 1 - dow
  return shiftCalendarDate(today, mondayOffset)
}

export function selectableWeekStarts(now: Date, timeZone = REPORT_TIMEZONE): string[] {
  const current = currentWeekStart(now, timeZone)
  return Array.from({ length: WEEKLY_LOOKBACK_WEEKS + 1 }, (_, index) => shiftCalendarDate(current, -7 * index))
}

export function isSelectableWeek(weekStart: string, now: Date, timeZone = REPORT_TIMEZONE): boolean {
  return selectableWeekStarts(now, timeZone).includes(weekStart)
}

export function weekLabel(weekStart: string): string {
  const end = shiftCalendarDate(weekStart, 6)
  const startText = formatUtcDate(weekStart)
  const endText = formatUtcDate(end)
  return `${startText} – ${endText}, ${end.slice(0, 4)}`
}

function formatUtcDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number)
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(year, month - 1, day)))
}

function offsetFromMonday(weekday: number): number {
  return weekday === 0 ? 6 : weekday - 1
}

export function weeklyDeadlineLabel(weekday: number, time: string, timeZone: string): string {
  const day = WEEKDAY_NAMES[weekday] ?? 'Friday'
  return `${day} ${time} (${timeZone})`
}

/** True once local time reaches the configured deadline on that weekday of the week. */
export function isPastWeeklyDeadline(
  weekStart: string,
  weekday: number,
  time: string,
  now: Date,
  timeZone = REPORT_TIMEZONE,
): boolean {
  if (!isRealMonday(weekStart)) return false
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time)
  if (!match || weekday < 0 || weekday > 6) return false
  const deadlineDate = shiftCalendarDate(weekStart, offsetFromMonday(weekday))
  const [year, month, day] = deadlineDate.split('-').map(Number)
  const local = zonedParts(now, timeZone)
  const nowEncoded = Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute, local.second)
  const deadlineEncoded = Date.UTC(year, month - 1, day, Number(match[1]), Number(match[2]), 0)
  return nowEncoded >= deadlineEncoded
}

export function suggestFromDailyDone(rows: DailyDoneRow[]): string {
  return rows
    .map((row) => ({ reportDate: row.reportDate, doneToday: row.doneToday.trim() }))
    .filter((row) => row.reportDate && row.doneToday)
    .sort((a, b) => a.reportDate.localeCompare(b.reportDate))
    .map((row) => `${row.reportDate}\n${row.doneToday}`)
    .join('\n\n')
}

export function validateWeeklyInput(input: WeeklyInput, now: Date, timeZone = REPORT_TIMEZONE): WeeklyFieldErrors {
  const errors: WeeklyFieldErrors = {}
  if (!isSelectableWeek(input.weekStart, now, timeZone)) errors.weekStart = messages.weeklyWeek
  if (input.intent === 'submit') {
    if (!input.highlights.trim()) errors.highlights = messages.highlightsRequired
    if (!input.progress.trim()) errors.progress = messages.progressRequired
    if (!input.risks.trim()) errors.risks = messages.risksRequired
    if (!input.nextWeek.trim()) errors.nextWeek = messages.nextWeekRequired
  }
  return errors
}
