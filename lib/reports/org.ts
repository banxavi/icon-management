import { getSql } from '@/lib/db'
import { DEFAULT_WEEKLY_DEADLINE_TIME, DEFAULT_WEEKLY_DEADLINE_WEEKDAY } from '@/lib/reports/weekly'
import { REPORT_TIMEZONE } from '@/lib/reports/window'

export type ReportSettings = {
  timeZone: string
  weeklyDeadlineWeekday: number
  weeklyDeadlineTime: string
}

const fallback: ReportSettings = {
  timeZone: REPORT_TIMEZONE,
  weeklyDeadlineWeekday: DEFAULT_WEEKLY_DEADLINE_WEEKDAY,
  weeklyDeadlineTime: DEFAULT_WEEKLY_DEADLINE_TIME,
}

export async function loadReportSettings(): Promise<ReportSettings> {
  const sql = getSql()
  if (!sql) return fallback
  const rows = await sql`
    select timezone, weekly_deadline_weekday, weekly_deadline_time
    from public.org_settings
    limit 1
  `
  const data = rows[0]
  if (!data) return fallback
  const weekday = Number(data.weekly_deadline_weekday)
  const time = typeof data.weekly_deadline_time === 'string' ? data.weekly_deadline_time : ''
  return {
    timeZone: typeof data.timezone === 'string' && data.timezone ? data.timezone : fallback.timeZone,
    weeklyDeadlineWeekday: Number.isInteger(weekday) && weekday >= 0 && weekday <= 6 ? weekday : fallback.weeklyDeadlineWeekday,
    weeklyDeadlineTime: /^([01]\d|2[0-3]):[0-5]\d$/.test(time) ? time : fallback.weeklyDeadlineTime,
  }
}
