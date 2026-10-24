'use server'

import { revalidatePath } from 'next/cache'
import { requireSession } from '@/lib/auth/session'
import { canSubmitReport, canViewTeamDashboard } from '@/lib/auth/permissions'
import { mapReport } from '@/lib/data/rows'
import { messages } from '@/lib/messages'
import { mapWriteError } from '@/lib/reports/errors'
import { normalizeWorkStatus, validateReportInput, type ReportInput } from '@/lib/reports/validation'
import { calendarDateInZone } from '@/lib/reports/window'
import { createClient } from '@/lib/supabase/server'
import type { DailyReportRecord } from '@/lib/types'

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
  const fieldErrors = validateReportInput(normalized, new Date())
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
