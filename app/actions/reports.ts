'use server'

import { revalidatePath } from 'next/cache'
import { requireSession } from '@/lib/auth/session'
import { canSubmitReport, canViewTeamDashboard } from '@/lib/auth/permissions'
import { mapReport, mapWeeklyReport } from '@/lib/data/rows'
import { getSql, withAuthUid } from '@/lib/db'
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

async function auditDenied(actorId: string, objectType: string, metadata: Record<string, unknown>) {
  try {
    await withAuthUid(
      actorId,
      (sql) => sql`select public.audit_access_denied(${objectType}, null, ${JSON.stringify(metadata)}::jsonb)`,
    )
  } catch {
    // Best-effort.
  }
}

export async function loadOwnReport(reportDate: string): Promise<DailyReportRecord | null> {
  const session = await requireSession()
  const sql = getSql()
  if (!sql) return null
  const rows = await sql`
    select dr.*, p.name as project_name
    from public.daily_reports dr
    left join public.projects p on p.id = dr.project_id
    where dr.user_id = ${session.id}::uuid and dr.report_date = ${reportDate}::date
    limit 1
  `
  const data = rows[0]
  return data ? mapReport({ ...data, projects: { name: data.project_name } }) : null
}

export async function saveDailyReport(input: ReportInput): Promise<SaveResult> {
  const session = await requireSession()
  if (!canSubmitReport(session.roles)) {
    await auditDenied(session.id, 'daily_report', { path: '/reports/daily/new', reason: 'role_cannot_submit' })
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

  const sql = getSql()
  if (!sql) return { ok: false, error: messages.saveFailed }

  const existingRows = await sql`
    select status from public.daily_reports
    where user_id = ${session.id}::uuid and report_date = ${normalized.reportDate}::date
    limit 1
  `
  const existing = existingRows[0]
  const status = normalized.intent === 'submit' || existing?.status === 'submitted' ? 'submitted' : 'draft'
  try {
    const rows = await sql`
      insert into public.daily_reports (
        user_id, report_date, project_id, work_status, wfh_reason, done_today, next_plan, blockers, status
      ) values (
        ${session.id}::uuid,
        ${normalized.reportDate}::date,
        ${normalized.projectId}::uuid,
        ${normalized.workStatus},
        ${normalized.workStatus === 'wfh' ? normalized.wfhReason.trim() : null},
        ${normalized.doneToday},
        ${normalized.nextPlan},
        ${normalized.blockers.trim() || null},
        ${status}
      )
      on conflict (user_id, report_date) do update set
        project_id = excluded.project_id,
        work_status = excluded.work_status,
        wfh_reason = excluded.wfh_reason,
        done_today = excluded.done_today,
        next_plan = excluded.next_plan,
        blockers = excluded.blockers,
        status = excluded.status,
        updated_at = now()
      returning *
    `
    const data = rows[0]
    if (!data) return { ok: false, error: messages.saveFailed }
    const projectRows = await sql`select name from public.projects where id = ${data.project_id}::uuid limit 1`
    const mapped = mapReport({ ...data, projects: { name: projectRows[0]?.name } })

    if (normalized.intent === 'submit') {
      try {
        await withAuthUid(session.id, (authSql) => authSql`select public.notify_daily_report(${data.id}::uuid)`)
      } catch {
        refresh()
        return { ok: false, error: 'The report was saved, but the in-app notification could not be sent.', report: mapped }
      }
    }

    refresh()
    return {
      ok: true,
      report: mapped,
      message: normalized.intent === 'draft' ? messages.savedDraft : existing?.status === 'submitted' ? messages.updated : messages.submitted,
    }
  } catch (error) {
    return { ok: false, error: mapWriteError(error instanceof Error ? error.message : '') }
  }
}

export async function loadTeamBoard(reportDate: string) {
  const session = await requireSession()
  if (!canViewTeamDashboard(session.roles)) {
    await auditDenied(session.id, 'page', { path: '/team/dashboard' })
    return { forbidden: true as const, reportDate, rows: [], projects: [] as { id: string; name: string }[] }
  }
  const sql = getSql()
  if (!sql || !session.teamId) {
    return { forbidden: false as const, reportDate, rows: [], projects: [] as { id: string; name: string }[] }
  }

  const [people, reports, projects, memberships] = await sql.transaction([
    sql`select id, full_name, email from public.profiles where team_id = ${session.teamId}::uuid order by full_name`,
    sql`
      select dr.*, p.name as project_name
      from public.daily_reports dr
      left join public.projects p on p.id = dr.project_id
      where dr.report_date = ${reportDate}::date
    `,
    sql`select id, name from public.projects where team_id = ${session.teamId}::uuid order by name`,
    sql`
      select pm.user_id, pm.project_id, p.name as project_name
      from public.project_members pm
      join public.projects p on p.id = pm.project_id
    `,
  ])

  const reportByUser = new Map(reports.map((row) => [String(row.user_id), mapReport({ ...row, projects: { name: row.project_name } })]))
  const projectsByUser = new Map<string, string[]>()
  for (const membership of memberships) {
    const userId = String(membership.user_id)
    const name = String(membership.project_name || '')
    const list = projectsByUser.get(userId) ?? []
    if (name) list.push(name)
    projectsByUser.set(userId, list)
  }

  const rows = people.map((person) => {
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
    projects: projects.map((project) => ({ id: String(project.id), name: String(project.name) })),
  }
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
    await auditDenied(session.id, 'weekly_report', { path: '/reports/weekly', reason: 'role_cannot_submit' })
    return { ok: false, error: messages.forbidden }
  }

  const settings = await loadReportSettings()
  const now = new Date()
  const selected = weekStart || currentWeekStart(now, settings.timeZone)
  if (!isSelectableWeek(selected, now, settings.timeZone)) return { ok: false, error: messages.weeklyWeek }

  const sql = getSql()
  if (!sql) return { ok: false, error: messages.saveFailed }
  const weekEnd = shiftCalendarDate(selected, 6)
  const [reportRows, dailies] = await sql.transaction([
    sql`select * from public.weekly_reports where user_id = ${session.id}::uuid and week_start = ${selected}::date limit 1`,
    sql`
      select report_date, done_today from public.daily_reports
      where user_id = ${session.id}::uuid
        and report_date >= ${selected}::date
        and report_date <= ${weekEnd}::date
      order by report_date
    `,
  ])

  const suggestion = suggestFromDailyDone(
    dailies.map((row) => ({
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
      report: reportRows[0] ? mapWeeklyReport(reportRows[0] as Record<string, unknown>) : null,
      weeks: selectableWeekStarts(now, settings.timeZone).map((start) => ({ weekStart: start, label: formatWeek(start) })),
    },
  }
}

export async function saveWeeklyReport(input: WeeklyInput): Promise<WeeklySaveResult> {
  const session = await requireSession()
  if (!canSubmitReport(session.roles)) {
    await auditDenied(session.id, 'weekly_report', { path: '/reports/weekly', reason: 'role_cannot_submit' })
    return { ok: false, error: messages.forbidden }
  }

  const settings = await loadReportSettings()
  const fieldErrors = validateWeeklyInput(input, new Date(), settings.timeZone)
  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, error: Object.values(fieldErrors)[0], fieldErrors }
  }

  const sql = getSql()
  if (!sql) return { ok: false, error: messages.saveFailed }

  const existingRows = await sql`
    select status from public.weekly_reports
    where user_id = ${session.id}::uuid and week_start = ${input.weekStart}::date
    limit 1
  `
  const existing = existingRows[0]
  const status = input.intent === 'submit' || existing?.status === 'submitted' ? 'submitted' : 'draft'
  try {
    await sql`
      insert into public.weekly_reports (
        user_id, week_start, highlights, progress, risks, next_week_plan, status
      ) values (
        ${session.id}::uuid,
        ${input.weekStart}::date,
        ${input.highlights.trim()},
        ${input.progress.trim()},
        ${input.risks.trim()},
        ${input.nextWeek.trim()},
        ${status}
      )
      on conflict (user_id, week_start) do update set
        highlights = excluded.highlights,
        progress = excluded.progress,
        risks = excluded.risks,
        next_week_plan = excluded.next_week_plan,
        status = excluded.status,
        updated_at = now()
    `
  } catch (error) {
    return { ok: false, error: mapWriteError(error instanceof Error ? error.message : '') }
  }

  refreshWeekly()
  const loaded = await loadWeeklyContext(input.weekStart)
  return {
    ok: true,
    message: input.intent === 'draft' ? messages.weeklyDraft : existing?.status === 'submitted' ? messages.weeklyUpdated : messages.weeklySubmitted,
    context: loaded.ok ? loaded.context : undefined,
  }
}
