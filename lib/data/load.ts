import { roleLabel } from '@/lib/auth/permissions'
import { asRole, asStringArray, mapReport, relatedName } from '@/lib/data/rows'
import { notificationHistoryStart } from '@/lib/notifications/history'
import { calendarDateInZone, weekdaysOfWeek } from '@/lib/reports/window'
import { createClient } from '@/lib/supabase/server'
import type { AppRole, SessionUser } from '@/lib/types'
import type { AdminUser } from '@/components/admin-panel'
import type { DirectoryPerson } from '@/components/directory-panel'
import type { AssignedReport, WeekDay } from '@/components/dashboard-home'
import type { Notice } from '@/components/notification-center'
import type { TeamRow } from '@/components/team-dashboard'

const dayLabel = new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: 'Asia/Saigon' })

export async function loadShell(session: SessionUser): Promise<{ unreadCount: number; weekSubmitted: number; notices: Notice[] }> {
  const supabase = await createClient()
  const days = weekdaysOfWeek(new Date())
  if (!supabase) return { unreadCount: 0, weekSubmitted: 0, notices: [] }
  const since = notificationHistoryStart(new Date()).toISOString()
  const [{ count: unread }, { count: submitted }, { data: noticeRows }] = await Promise.all([
    supabase.from('notifications').select('id', { count: 'exact', head: true }).eq('recipient_id', session.id).is('read_at', null).gte('created_at', since),
    supabase.from('daily_reports').select('id', { count: 'exact', head: true }).eq('user_id', session.id).eq('status', 'submitted').in('report_date', days),
    supabase.from('notifications').select('id, title, body, read_at, created_at').eq('recipient_id', session.id).gte('created_at', since).order('created_at', { ascending: false }).limit(8),
  ])
  return { unreadCount: unread ?? 0, weekSubmitted: submitted ?? 0, notices: (noticeRows ?? []).map(mapNotice) }
}

export async function loadHome(session: SessionUser) {
  const supabase = await createClient()
  const today = calendarDateInZone(new Date())
  const days = weekdaysOfWeek(new Date())
  const emptyWeek: WeekDay[] = days.map((date) => ({
    date,
    label: dayLabel.format(new Date(`${date}T12:00:00+07:00`)),
    submitted: false,
  }))
  if (!supabase) return { today, report: null, week: emptyWeek, assigned: [] as AssignedReport[] }

  const [{ data: reportRow }, { data: weekRows }, { data: assignedRows }] = await Promise.all([
    supabase.from('daily_reports').select('*, projects(name)').eq('user_id', session.id).eq('report_date', today).maybeSingle(),
    supabase.from('daily_reports').select('report_date, status').eq('user_id', session.id).in('report_date', days),
    session.roles.includes('reviewer')
      ? supabase.from('daily_reports').select('*, projects(name), profiles(full_name)').eq('status', 'submitted').order('report_date', { ascending: false }).limit(30)
      : Promise.resolve({ data: [] as unknown[] }),
  ])
  const submittedDates = new Set((weekRows ?? []).filter((row) => row.status === 'submitted').map((row) => String(row.report_date)))
  const assigned: AssignedReport[] = (assignedRows ?? []).map((row) => {
    const report = mapReport(row as Record<string, unknown>)
    const profiles = (row as { profiles?: { full_name?: string } | { full_name?: string }[] }).profiles
    const author = Array.isArray(profiles) ? profiles[0]?.full_name : profiles?.full_name
    return {
      id: report.id,
      author: author || 'Member',
      reportDate: report.reportDate,
      projectName: report.projectName,
      blockers: report.blockers,
      workStatus: report.workStatus,
    }
  }).filter((row) => row.author !== session.fullName || session.roles.includes('reviewer'))

  return {
    today,
    report: reportRow ? mapReport(reportRow as Record<string, unknown>) : null,
    week: days.map((date) => ({ date, label: dayLabel.format(new Date(`${date}T12:00:00+07:00`)), submitted: submittedDates.has(date) })),
    assigned,
  }
}

export async function loadProjects(session: SessionUser) {
  const supabase = await createClient()
  if (!supabase) return []
  const { data: mine } = await supabase.from('project_members').select('project_id, projects(id, name)').eq('user_id', session.id)
  const fromMembership = (mine ?? []).map((row) => {
    const project = (row as { projects?: { id?: string; name?: string } | { id?: string; name?: string }[] }).projects
    const value = Array.isArray(project) ? project[0] : project
    return value?.id && value.name ? { id: String(value.id), name: String(value.name) } : null
  }).filter((item): item is { id: string; name: string } => Boolean(item))
  if (fromMembership.length > 0) return fromMembership
  const { data } = await supabase.from('projects').select('id, name').order('name')
  return (data ?? []).map((project) => ({ id: String(project.id), name: String(project.name) }))
}

export async function loadDirectory(session: SessionUser): Promise<DirectoryPerson[]> {
  const supabase = await createClient()
  if (!supabase) return []
  let peopleQuery = supabase.from('profiles').select('id, full_name, email, contact, skills, team_id').order('full_name')
  if (session.teamId) peopleQuery = peopleQuery.eq('team_id', session.teamId)
  const [{ data: people }, { data: roleRows }, { data: memberships }] = await Promise.all([
    peopleQuery,
    supabase.from('user_roles').select('user_id, roles(code)'),
    supabase.from('project_members').select('user_id, projects(name)'),
  ])
  const rolesByUser = new Map<string, string[]>()
  for (const row of roleRows ?? []) {
    const userId = String((row as { user_id: string }).user_id)
    const code = asRole(relatedCode(row))
    if (!code) continue
    rolesByUser.set(userId, [...(rolesByUser.get(userId) ?? []), roleLabel(code)])
  }
  const projectsByUser = new Map<string, string[]>()
  for (const row of memberships ?? []) {
    const userId = String((row as { user_id: string }).user_id)
    const name = relatedName((row as { projects?: unknown }).projects)
    if (!name) continue
    projectsByUser.set(userId, [...(projectsByUser.get(userId) ?? []), name])
  }
  return (people ?? []).map((person) => ({
    id: String(person.id),
    fullName: String(person.full_name),
    email: String(person.email),
    contact: typeof person.contact === 'string' ? person.contact : '',
    skills: asStringArray(person.skills),
    roles: rolesByUser.get(String(person.id)) ?? [],
    projects: projectsByUser.get(String(person.id)) ?? [],
  }))
}

function relatedCode(row: unknown): unknown {
  if (!row || typeof row !== 'object' || !('roles' in row)) return null
  const roles = (row as { roles?: { code?: string } | { code?: string }[] }).roles
  return Array.isArray(roles) ? roles[0]?.code : roles?.code
}

function mapNotice(row: { id: unknown; title: unknown; body: unknown; read_at: unknown; created_at: unknown }): Notice {
  return {
    id: String(row.id),
    title: String(row.title),
    body: String(row.body),
    createdAt: String(row.created_at),
    unread: !row.read_at,
  }
}

export async function loadNotifications(session: SessionUser): Promise<Notice[]> {
  const supabase = await createClient()
  if (!supabase) return []
  const since = notificationHistoryStart(new Date()).toISOString()
  const { data } = await supabase.from('notifications').select('id, title, body, read_at, created_at').eq('recipient_id', session.id).gte('created_at', since).order('created_at', { ascending: false }).limit(100)
  return (data ?? []).map(mapNotice)
}

export async function loadAdmin(): Promise<{ users: AdminUser[]; projects: string[]; settings: { timezone: string; retentionMonths: number; dailyWindow: string; maxUploadMb: number; allowedExtensions: string[]; weeklyDeadlineWeekday: number; weeklyDeadlineTime: string } }> {
  const supabase = await createClient()
  const empty = {
    users: [] as AdminUser[],
    projects: [] as string[],
    settings: {
      timezone: 'Asia/Saigon',
      retentionMonths: 12,
      dailyWindow: 'end_of_next_calendar_day',
      maxUploadMb: 50,
      allowedExtensions: ['pdf', 'docx', 'xlsx', 'pptx', 'md', 'png', 'jpg'],
      weeklyDeadlineWeekday: 5,
      weeklyDeadlineTime: '17:00',
    },
  }
  if (!supabase) return empty
  const [{ data: people }, { data: roleRows }, { data: memberships }, { data: assignments }, { data: projects }, { data: settings }] = await Promise.all([
    supabase.from('profiles').select('id, full_name, email, status').order('full_name'),
    supabase.from('user_roles').select('user_id, roles(code)'),
    supabase.from('project_members').select('user_id, projects(name)'),
    supabase.from('reviewer_assignments').select('reviewer_id, member_id'),
    supabase.from('projects').select('name').order('name'),
    supabase.from('org_settings').select('timezone, retention_months, daily_window, max_upload_mb, allowed_extensions, weekly_deadline_weekday, weekly_deadline_time').limit(1).maybeSingle(),
  ])
  const roleByUser = new Map<string, AppRole>()
  for (const row of roleRows ?? []) {
    const code = asRole(relatedCode(row))
    if (code) roleByUser.set(String((row as { user_id: string }).user_id), code)
  }
  const projectByUser = new Map<string, string>()
  for (const row of memberships ?? []) {
    const name = relatedName((row as { projects?: unknown }).projects)
    if (name) projectByUser.set(String((row as { user_id: string }).user_id), name)
  }
  const assigned = new Map<string, string[]>()
  for (const row of assignments ?? []) {
    const reviewerId = String((row as { reviewer_id: string }).reviewer_id)
    assigned.set(reviewerId, [...(assigned.get(reviewerId) ?? []), String((row as { member_id: string }).member_id)])
  }
  return {
    users: (people ?? []).map((person) => ({
      id: String(person.id),
      fullName: String(person.full_name),
      email: String(person.email),
      status: person.status === 'inactive' ? 'inactive' : 'active',
      role: roleByUser.get(String(person.id)) ?? 'member',
      project: projectByUser.get(String(person.id)) ?? '',
      assignedMemberIds: assigned.get(String(person.id)) ?? [],
    })),
    projects: (projects ?? []).map((project) => String(project.name)),
    settings: {
      timezone: settings?.timezone ? String(settings.timezone) : 'Asia/Saigon',
      retentionMonths: Number(settings?.retention_months ?? 12),
      dailyWindow: settings?.daily_window ? String(settings.daily_window) : 'end_of_next_calendar_day',
      maxUploadMb: Number(settings?.max_upload_mb ?? 50),
      allowedExtensions: Array.isArray(settings?.allowed_extensions) && settings.allowed_extensions.length > 0
        ? settings.allowed_extensions.map(String)
        : ['pdf', 'docx', 'xlsx', 'pptx', 'md', 'png', 'jpg'],
      weeklyDeadlineWeekday: Number.isInteger(Number(settings?.weekly_deadline_weekday)) ? Number(settings?.weekly_deadline_weekday) : 5,
      weeklyDeadlineTime: typeof settings?.weekly_deadline_time === 'string' && settings.weekly_deadline_time ? settings.weekly_deadline_time : '17:00',
    },
  }
}

export async function loadTeamRows(session: SessionUser, reportDate: string): Promise<{ rows: TeamRow[]; projects: { id: string; name: string }[] }> {
  const { loadTeamBoard } = await import('@/app/actions/reports')
  const result = await loadTeamBoard(reportDate)
  if (result.forbidden || !session.teamId) return { rows: [], projects: [] }
  return { rows: result.rows, projects: result.projects }
}
