import { requireSession } from '@/lib/auth/session'
import { canSubmitReport } from '@/lib/auth/permissions'
import { loadProjects } from '@/lib/data/load'
import { Forbidden } from '@/components/forbidden'
import { DailyReportForm } from '@/components/daily-report-form'
import { getSql } from '@/lib/db'
import { mapReport } from '@/lib/data/rows'
import { loadReportSettings } from '@/lib/reports/org'
import { calendarDateInZone, openReportDateBounds } from '@/lib/reports/window'

export const dynamic = 'force-dynamic'

export default async function NewDailyReportPage() {
  const session = await requireSession()
  if (!canSubmitReport(session.roles)) return <Forbidden />
  const now = new Date()
  const settings = await loadReportSettings()
  const bounds = openReportDateBounds(now, settings.timeZone)
  const today = calendarDateInZone(now, settings.timeZone)
  const projects = await loadProjects(session)
  const sql = getSql()
  const rows = sql
    ? await sql`
        select dr.*, p.name as project_name
        from public.daily_reports dr
        left join public.projects p on p.id = dr.project_id
        where dr.user_id = ${session.id}::uuid and dr.report_date = ${today}::date
        limit 1
      `
    : []
  const data = rows[0]
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <p className="text-sm font-medium text-[#e2894b]">DAILY REPORT</p>
        <h1 className="mt-1 text-3xl font-semibold">Submit a daily report</h1>
        <p className="mt-2 text-slate-500">Share a short update so the team can see progress. Declare WFH here, with a reason.</p>
      </div>
      <DailyReportForm projects={projects} initialDate={today} minDate={bounds.min} maxDate={bounds.max} initialReport={data ? mapReport({ ...data, projects: { name: data.project_name } }) : null} timeZone={settings.timeZone} />
    </div>
  )
}
