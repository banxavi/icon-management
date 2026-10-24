import type { AppRole, DailyReportRecord, WorkStatus } from '@/lib/types'

export function relatedName(value: unknown): string {
  if (!value) return ''
  if (Array.isArray(value)) return relatedName(value[0])
  if (typeof value === 'object' && value && 'name' in value) return String((value as { name?: string }).name ?? '')
  return ''
}

export function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

export function asRole(value: unknown): AppRole | null {
  if (value === 'member' || value === 'team_leader' || value === 'reviewer' || value === 'admin' || value === 'document_owner') {
    return value
  }
  return null
}

export function mapReport(row: Record<string, unknown>): DailyReportRecord {
  const workStatus: WorkStatus = row.work_status === 'wfh' ? 'wfh' : 'office'
  return {
    id: String(row.id),
    userId: String(row.user_id),
    reportDate: String(row.report_date),
    projectId: String(row.project_id),
    projectName: relatedName(row.projects),
    workStatus,
    wfhReason: typeof row.wfh_reason === 'string' ? row.wfh_reason : '',
    doneToday: typeof row.done_today === 'string' ? row.done_today : '',
    nextPlan: typeof row.next_plan === 'string' ? row.next_plan : '',
    blockers: typeof row.blockers === 'string' ? row.blockers : '',
    status: row.status === 'submitted' ? 'submitted' : 'draft',
    submittedAt: typeof row.submitted_at === 'string' ? row.submitted_at : null,
    isLate: Boolean(row.is_late),
    edited: Boolean(row.edited_after_submit),
  }
}
