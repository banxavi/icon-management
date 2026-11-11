import { roleLabel } from '@/lib/auth/permissions'
import { asRole, asStringArray, mapReport } from '@/lib/data/rows'
import { getSql } from '@/lib/db'
import { notificationHistoryStart } from '@/lib/notifications/history'
import { calendarDateInZone, weekdaysOfWeek } from '@/lib/reports/window'
import type { AppRole, SessionUser } from '@/lib/types'
import type { AdminUser } from '@/components/admin-panel'
import type { DirectoryPerson } from '@/components/directory-panel'
import type { AssignedReport, WeekDay } from '@/components/dashboard-home'
import type { Notice } from '@/components/notification-center'
import type { TeamRow } from '@/components/team-dashboard'

const dayLabel = new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: 'Asia/Saigon' })

function mapNotice(row: Record<string, unknown>): Notice {
  return {
    id: String(row.id),
    title: String(row.title),
    body: String(row.body),
    createdAt: String(row.created_at),
    unread: !row.read_at,
  }
}

export async function loadShell(session: SessionUser): Promise<{ unreadCount: number; weekSubmitted: number; notices: Notice[] }> {
  const sql = getSql()
  const days = weekdaysOfWeek(new Date())
  if (!sql) return { unreadCount: 0, weekSubmitted: 0, notices: [] }
  const since = notificationHistoryStart(new Date()).toISOString()
  const [unreadRows, submittedRows, noticeRows] = await Promise.all([
    sql`select count(*)::int as c from public.notifications where recipient_id = ${session.id}::uuid and read_at is null and created_at >= ${since}::timestamptz`,
    sql`select count(*)::int as c from public.daily_reports where user_id = ${session.id}::uuid and status = 'submitted' and report_date = any(${days}::date[])`,
    sql`select id, title, body, read_at, created_at from public.notifications where recipient_id = ${session.id}::uuid and created_at >= ${since}::timestamptz order by created_at desc limit 8`,
  ])
  return {
    unreadCount: Number(unreadRows[0]?.c ?? 0),
    weekSubmitted: Number(submittedRows[0]?.c ?? 0),
    notices: noticeRows.map(mapNotice),
  }
}

export async function loadHome(session: SessionUser) {
  const sql = getSql()
  const today = calendarDateInZone(new Date())
  const days = weekdaysOfWeek(new Date())
  const emptyWeek: WeekDay[] = days.map((date) => ({
    date,
    label: dayLabel.format(new Date(`${date}T12:00:00+07:00`)),
    submitted: false,
  }))
  if (!sql) return { today, report: null, week: emptyWeek, assigned: [] as AssignedReport[] }

  const [reportRows, weekRows, assignedRows] = await Promise.all([
    sql`
      select dr.*, p.name as project_name
      from public.daily_reports dr
      left join public.projects p on p.id = dr.project_id
      where dr.user_id = ${session.id}::uuid and dr.report_date = ${today}::date
      limit 1
    `,
    sql`
      select report_date, status from public.daily_reports
      where user_id = ${session.id}::uuid and report_date = any(${days}::date[])
    `,
    session.roles.includes('reviewer')
      ? sql`
          select dr.*, p.name as project_name, pr.full_name as author_name
          from public.daily_reports dr
          left join public.projects p on p.id = dr.project_id
          left join public.profiles pr on pr.id = dr.user_id
          where dr.status = 'submitted'
          order by dr.report_date desc
          limit 30
        `
      : Promise.resolve([] as Record<string, unknown>[]),
  ])

  const submittedDates = new Set(weekRows.filter((row) => row.status === 'submitted').map((row) => String(row.report_date)))
  const assigned: AssignedReport[] = assignedRows.map((row) => {
    const report = mapReport({ ...row, projects: { name: row.project_name } })
    return {
      id: report.id,
      author: String(row.author_name || 'Member'),
      reportDate: report.reportDate,
      projectName: report.projectName,
      blockers: report.blockers,
      workStatus: report.workStatus,
    }
  }).filter((row) => row.author !== session.fullName || session.roles.includes('reviewer'))

  const reportRow = reportRows[0]
  return {
    today,
    report: reportRow ? mapReport({ ...reportRow, projects: { name: reportRow.project_name } }) : null,
    week: days.map((date) => ({ date, label: dayLabel.format(new Date(`${date}T12:00:00+07:00`)), submitted: submittedDates.has(date) })),
    assigned,
  }
}

export async function loadProjects(session: SessionUser) {
  const sql = getSql()
  if (!sql) return []
  const mine = await sql`
    select p.id, p.name
    from public.project_members pm
    join public.projects p on p.id = pm.project_id
    where pm.user_id = ${session.id}::uuid
  `
  if (mine.length > 0) return mine.map((p) => ({ id: String(p.id), name: String(p.name) }))
  const data = await sql`select id, name from public.projects order by name`
  return data.map((project) => ({ id: String(project.id), name: String(project.name) }))
}

export async function loadDirectory(session: SessionUser): Promise<DirectoryPerson[]> {
  const sql = getSql()
  if (!sql) return []
  const people = session.teamId
    ? await sql`select id, full_name, email, contact, skills, team_id from public.profiles where team_id = ${session.teamId}::uuid order by full_name`
    : await sql`select id, full_name, email, contact, skills, team_id from public.profiles order by full_name`
  const [roleRows, memberships] = await Promise.all([
    sql`select ur.user_id, r.code from public.user_roles ur join public.roles r on r.id = ur.role_id`,
    sql`select pm.user_id, p.name from public.project_members pm join public.projects p on p.id = pm.project_id`,
  ])
  const rolesByUser = new Map<string, string[]>()
  for (const row of roleRows) {
    const code = asRole(row.code)
    if (!code) continue
    const userId = String(row.user_id)
    rolesByUser.set(userId, [...(rolesByUser.get(userId) ?? []), roleLabel(code)])
  }
  const projectsByUser = new Map<string, string[]>()
  for (const row of memberships) {
    const userId = String(row.user_id)
    const name = String(row.name)
    projectsByUser.set(userId, [...(projectsByUser.get(userId) ?? []), name])
  }
  return people.map((person) => ({
    id: String(person.id),
    fullName: String(person.full_name),
    email: String(person.email),
    contact: typeof person.contact === 'string' ? person.contact : '',
    skills: asStringArray(person.skills),
    roles: rolesByUser.get(String(person.id)) ?? [],
    projects: projectsByUser.get(String(person.id)) ?? [],
  }))
}

export async function loadNotifications(session: SessionUser): Promise<Notice[]> {
  const sql = getSql()
  if (!sql) return []
  const since = notificationHistoryStart(new Date()).toISOString()
  const data = await sql`
    select id, title, body, read_at, created_at
    from public.notifications
    where recipient_id = ${session.id}::uuid and created_at >= ${since}::timestamptz
    order by created_at desc
    limit 100
  `
  return data.map(mapNotice)
}

export async function loadAdmin(): Promise<{ users: AdminUser[]; projects: string[]; settings: { timezone: string; retentionMonths: number; dailyWindow: string; maxUploadMb: number; allowedExtensions: string[]; weeklyDeadlineWeekday: number; weeklyDeadlineTime: string } }> {
  const sql = getSql()
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
  if (!sql) return empty
  const [people, roleRows, memberships, assignments, projects, settingsRows] = await Promise.all([
    sql`select id, full_name, email, status from public.profiles order by full_name`,
    sql`select ur.user_id, r.code from public.user_roles ur join public.roles r on r.id = ur.role_id`,
    sql`select pm.user_id, p.name from public.project_members pm join public.projects p on p.id = pm.project_id`,
    sql`select reviewer_id, member_id from public.reviewer_assignments`,
    sql`select name from public.projects order by name`,
    sql`select timezone, retention_months, daily_window, max_upload_mb, allowed_extensions, weekly_deadline_weekday, weekly_deadline_time from public.org_settings limit 1`,
  ])
  const settings = settingsRows[0]
  const roleByUser = new Map<string, AppRole>()
  for (const row of roleRows) {
    const code = asRole(row.code)
    if (code) roleByUser.set(String(row.user_id), code)
  }
  const projectByUser = new Map<string, string>()
  for (const row of memberships) {
    projectByUser.set(String(row.user_id), String(row.name))
  }
  const assigned = new Map<string, string[]>()
  for (const row of assignments) {
    const reviewerId = String(row.reviewer_id)
    assigned.set(reviewerId, [...(assigned.get(reviewerId) ?? []), String(row.member_id)])
  }
  return {
    users: people.map((person) => ({
      id: String(person.id),
      fullName: String(person.full_name),
      email: String(person.email),
      status: person.status === 'inactive' ? 'inactive' : 'active',
      role: roleByUser.get(String(person.id)) ?? 'member',
      project: projectByUser.get(String(person.id)) ?? '',
      assignedMemberIds: assigned.get(String(person.id)) ?? [],
    })),
    projects: projects.map((project) => String(project.name)),
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
