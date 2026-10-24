import { DEFAULT_WEEKLY_DEADLINE_TIME, DEFAULT_WEEKLY_DEADLINE_WEEKDAY } from '@/lib/reports/weekly'
import { REPORT_TIMEZONE } from '@/lib/reports/window'
import { createClient } from '@/lib/supabase/server'

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
  const supabase = await createClient()
  if (!supabase) return fallback
  const { data } = await supabase
    .from('org_settings')
    .select('timezone, weekly_deadline_weekday, weekly_deadline_time')
    .limit(1)
    .maybeSingle()
  if (!data) return fallback
  const weekday = Number(data.weekly_deadline_weekday)
  const time = typeof data.weekly_deadline_time === 'string' ? data.weekly_deadline_time : ''
  return {
    timeZone: typeof data.timezone === 'string' && data.timezone ? data.timezone : fallback.timeZone,
    weeklyDeadlineWeekday: Number.isInteger(weekday) && weekday >= 0 && weekday <= 6 ? weekday : fallback.weeklyDeadlineWeekday,
    weeklyDeadlineTime: /^([01]\d|2[0-3]):[0-5]\d$/.test(time) ? time : fallback.weeklyDeadlineTime,
  }
}
