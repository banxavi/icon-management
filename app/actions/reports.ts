'use server'

import { revalidatePath } from 'next/cache'
import { requireSession } from '@/lib/auth/session'
import { canSubmitReport, canViewTeamDashboard } from '@/lib/auth/permissions'
import { mapReport, mapWeeklyReport } from '@/lib/data/rows'
import { messages } from '@/lib/messages'
import { mapWriteError } from '@/lib/reports/errors'
import { loadReportSettings } from '@/lib/reports/org'
import { normalizeWorkStatus, validateReportInput, type ReportInput } from '@/lib/reports/validation'
import { calendarDateInZone, shiftCalendarDate } from '@/lib/reports/window'
import {
  currentWeekStart,
  isPastWeeklyDeadline,
  isSelectableWeek,
  selectableWeekStarts,
  suggestFromDailyDone,
  validateWeeklyInput,
  weekLabel as formatWeek,
  weeklyDeadlineLabel,
  type WeeklyInput,
} from '@/lib/reports/weekly'
import { createClient } from '@/lib/supabase/server'
import type { DailyReportRecord, WeeklyReportRecord } from '@/lib/types'

export type SaveResult = {
  ok: boolean
  message?: string
  error?: string
  fieldErrors?: Record<string, string>
  report?: DailyReportRecord | null
}

function refresh() {
  revalidatePath('/dashboard')
  revalidatePath('/reports/daily/new')
  revalidatePath('/team/dashboard')
  revalidatePath('/notifications')
}

export async function loadOwnReport(reportDate: string): Promise<DailyReportRecord | null> {
  const session = await requireSession()
  const supabase = await createClient()
  if (!supabase) return null
  const { data } = await supabase
    .from('daily_reports')
    .select('*, projects(name)')
    .eq('user_id', session.id)
    .eq('report_date', reportDate)
    .maybeSingle()
  return data ? mapReport(data as Record<string, unknown>) : null
}

export async function saveDailyReport(input: ReportInput): Promise<SaveResult> {
  const session = await requireSession()
  if (!canSubmitReport(session.roles)) {
    const supabase = await createClient()
    await supabase?.rpc('audit_access_denied', {
      p_object_type: 'daily_report',
      p_object_id: null,
      p_metadata: { path: '/reports/daily/new', reason: 'role_cannot_submit' },
    })
    return { ok: false, error: messages.forbidden }
  }

  const workStatus = normalizeWorkStatus(input.workStatus)
  const normalized: ReportInput = {
    ...input,
    workStatus,
    wfhReason: workStatus === 'office' ? '' : input.wfhReason,
  }
  const settings = await loadReportSettings()
  const fieldErrors = validateReportInput(normalized, new Date(), settings.timeZone)
  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, error: Object.values(fieldErrors)[0], fieldErrors }
  }

  const supabase = await createClient()
  if (!supabase) return { ok: false, error: messages.saveFailed }

  const { data: existing } = await supabase
    .from('daily_reports')
    .select('status')
    .eq('user_id', session.id)
    .eq('report_date', normalized.reportDate)
    .maybeSingle()

  const status = normalized.intent === 'submit' || existing?.status === 'submitted' ? 'submitted' : 'draft'
  const { data, error } = await supabase
    .from('daily_reports')
    .upsert(
      {
        user_id: session.id,
        report_date: normalized.reportDate,
        project_id: normalized.projectId,
        work_status: normalized.workStatus,
        wfh_reason: normalized.workStatus === 'wfh' ? normalized.wfhReason.trim() : null,
        done_today: normalized.doneToday,
        next_plan: normalized.nextPlan,
        blockers: normalized.blockers.trim() || null,
        status,
      },
      { onConflict: 'user_id,report_date' },
    )
    .select('*, projects(name)')
    .single()

  if (error || !data) return { ok: false, error: mapWriteError(error?.message ?? '') }

  if (normalized.intent === 'submit') {
    const { error: notifyError } = await supabase.rpc('notify_daily_report', { p_id: data.id })
    if (notifyError) {
      refresh()
      return { ok: false, error: 'The report was saved, but the in-app notification could not be sent.', report: mapReport(data as Record<string, unknown>) }
    }
  }

  refresh()
  const report = mapReport(data as Record<string, unknown>)
  return {
    ok: true,
    report,
    message: normalized.intent === 'draft' ? messages.savedDraft : existing?.status === 'submitted' ? messages.updated : messages.submitted,
  }
}

export async function loadTeamBoard(reportDate: string) {
  const session = await requireSession()
  if (!canViewTeamDashboard(session.roles)) {
    const supabase = await createClient()
    await supabase?.rpc('audit_access_denied', {
      p_object_type: 'page',
      p_object_id: null,
      p_metadata: { path: '/team/dashboard' },
    })
    return { forbidden: true as const, reportDate, rows: [], projects: [] as { id: string; name: string }[] }
  }
  const supabase = await createClient()
  if (!supabase || !session.teamId) {
    return { forbidden: false as const, reportDate, rows: [], projects: [] as { id: string; name: string }[] }
  }

  const [{ data: people }, { data: reports }, { data: projects }, { data: memberships }] = await Promise.all([
    supabase.from('profiles').select('id, full_name, email').eq('team_id', session.teamId).order('full_name'),
    supabase.from('daily_reports').select('*, projects(name)').eq('report_date', reportDate),
    supabase.from('projects').select('id, name').eq('team_id', session.teamId).order('name'),
    supabase.from('project_members').select('user_id, project_id, projects(name)'),
  ])

  const reportByUser = new Map((reports ?? []).map((row) => [String((row as { user_id: string }).user_id), mapReport(row as Record<string, unknown>)]))
  const projectsByUser = new Map<string, string[]>()
  for (const membership of memberships ?? []) {
    const userId = String((membership as { user_id: string }).user_id)
    const name = relatedProject(membership)
    const list = projectsByUser.get(userId) ?? []
    if (name) list.push(name)
    projectsByUser.set(userId, list)
  }

  const rows = (people ?? []).map((person) => {
    const report = reportByUser.get(String(person.id)) ?? null
    const status: 'submitted' | 'not_submitted' | 'late' = !report || report.status !== 'submitted' ? 'not_submitted' : report.isLate ? 'late' : 'submitted'
    return {
      id: String(person.id),
      name: String(person.full_name),
      email: String(person.email),
      projects: projectsByUser.get(String(person.id)) ?? [],
      status,
      report,
    }
  })

  return {
    forbidden: false as const,
    reportDate: reportDate || calendarDateInZone(new Date()),
    rows,
    projects: (projects ?? []).map((project) => ({ id: String(project.id), name: String(project.name) })),
  }
}

function relatedProject(row: unknown): string {
  if (!row || typeof row !== 'object') return ''
  return relatedName((row as { projects?: unknown }).projects)
}

function relatedName(value: unknown): string {
  if (!value) return ''
  if (Array.isArray(value)) return relatedName(value[0])
  if (typeof value === 'object' && value && 'name' in value) return String((value as { name?: string }).name ?? '')
  return ''
}

export type WeeklyContext = {
  weekStart: string
  weekLabel: string
  deadlineLabel: string
  pastDeadline: boolean
  suggestion: string
  report: WeeklyReportRecord | null
  weeks: { weekStart: string; label: string }[]
}

export type WeeklyLoadResult = { ok: true; context: WeeklyContext } | { ok: false; error: string }

export type WeeklySaveResult = {
  ok: boolean
  message?: string
  error?: string
  fieldErrors?: Record<string, string>
  context?: WeeklyContext
}

function refreshWeekly() {
  revalidatePath('/reports/weekly')
  revalidatePath('/reports/weekly/new')
  revalidatePath('/dashboard')
}

export async function loadWeeklyContext(weekStart?: string): Promise<WeeklyLoadResult> {
  const session = await requireSession()
  if (!canSubmitReport(session.roles)) {
    const supabase = await createClient()
    await supabase?.rpc('audit_access_denied', {
      p_object_type: 'weekly_report',
      p_object_id: null,
      p_metadata: { path: '/reports/weekly', reason: 'role_cannot_submit' },
    })
    return { ok: false, error: messages.forbidden }
  }

  const settings = await loadReportSettings()
  const now = new Date()
  const selected = weekStart || currentWeekStart(now, settings.timeZone)
  if (!isSelectableWeek(selected, now, settings.timeZone)) return { ok: false, error: messages.weeklyWeek }

  const supabase = await createClient()
  if (!supabase) return { ok: false, error: messages.saveFailed }
  const weekEnd = shiftCalendarDate(selected, 6)
  const [{ data: reportRow }, { data: dailies }] = await Promise.all([
    supabase.from('weekly_reports').select('*').eq('user_id', session.id).eq('week_start', selected).maybeSingle(),
    supabase
      .from('daily_reports')
      .select('report_date, done_today')
      .eq('user_id', session.id)
      .gte('report_date', selected)
      .lte('report_date', weekEnd)
      .order('report_date'),
  ])

  const suggestion = suggestFromDailyDone(
    (dailies ?? []).map((row) => ({
      reportDate: String(row.report_date).slice(0, 10),
      doneToday: typeof row.done_today === 'string' ? row.done_today : '',
    })),
  )

  return {
    ok: true,
    context: {
      weekStart: selected,
      weekLabel: formatWeek(selected),
      deadlineLabel: weeklyDeadlineLabel(settings.weeklyDeadlineWeekday, settings.weeklyDeadlineTime, settings.timeZone),
      pastDeadline: isPastWeeklyDeadline(selected, settings.weeklyDeadlineWeekday, settings.weeklyDeadlineTime, now, settings.timeZone),
      suggestion,
      report: reportRow ? mapWeeklyReport(reportRow as Record<string, unknown>) : null,
      weeks: selectableWeekStarts(now, settings.timeZone).map((start) => ({ weekStart: start, label: formatWeek(start) })),
    },
  }
}

export async function saveWeeklyReport(input: WeeklyInput): Promise<WeeklySaveResult> {
  const session = await requireSession()
  if (!canSubmitReport(session.roles)) {
    const supabase = await createClient()
    await supabase?.rpc('audit_access_denied', {
      p_object_type: 'weekly_report',
      p_object_id: null,
      p_metadata: { path: '/reports/weekly', reason: 'role_cannot_submit' },
    })
    return { ok: false, error: messages.forbidden }
  }

  const settings = await loadReportSettings()
  const fieldErrors = validateWeeklyInput(input, new Date(), settings.timeZone)
  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, error: Object.values(fieldErrors)[0], fieldErrors }
  }

  const supabase = await createClient()
  if (!supabase) return { ok: false, error: messages.saveFailed }

  const { data: existing } = await supabase
    .from('weekly_reports')
    .select('status')
    .eq('user_id', session.id)
    .eq('week_start', input.weekStart)
    .maybeSingle()

  const status = input.intent === 'submit' || existing?.status === 'submitted' ? 'submitted' : 'draft'
  const { error } = await supabase.from('weekly_reports').upsert(
    {
      user_id: session.id,
      week_start: input.weekStart,
      highlights: input.highlights.trim(),
      progress: input.progress.trim(),
      risks: input.risks.trim(),
      next_week_plan: input.nextWeek.trim(),
      status,
    },
    { onConflict: 'user_id,week_start' },
  )
  if (error) return { ok: false, error: mapWriteError(error.message) }

  refreshWeekly()
  const loaded = await loadWeeklyContext(input.weekStart)
  return {
    ok: true,
    message: input.intent === 'draft' ? messages.weeklyDraft : existing?.status === 'submitted' ? messages.weeklyUpdated : messages.weeklySubmitted,
    context: loaded.ok ? loaded.context : undefined,
  }
}
