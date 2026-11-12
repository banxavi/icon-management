import { requireSession } from '@/lib/auth/session'
import { canSubmitReport } from '@/lib/auth/permissions'
import { loadProjects } from '@/lib/data/load'
import { Forbidden } from '@/components/forbidden'
import { DailyReportForm } from '@/components/daily-report-form'
import { PageHeader } from '@/components/layout'
import { getSql } from '@/lib/db'
import { mapReport } from '@/lib/data/rows'
import { loadReportSettings } from '@/lib/reports/org'
import { calendarDateInZone, openReportDateBounds } from '@/lib/reports/window'

export const dynamic = 'force-dynamic'

export default async function NewDailyReportPage() {
  const session = await requireSession()
  if (!canSubmitReport(session.roles)) return <Forbidden />
  const now = new Date()
  const sql = getSql()

  // Settings + projects are independent — fetch in parallel.
  const [settings, projects] = await Promise.all([loadReportSettings(), loadProjects(session)])
  const bounds = openReportDateBounds(now, settings.timeZone)
  const today = calendarDateInZone(now, settings.timeZone)
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
      <PageHeader eyebrow="Daily report" title="Submit a daily report" description="Share a short update so the team can see progress. Declare WFH here, with a reason." />
      <DailyReportForm projects={projects} initialDate={today} minDate={bounds.min} maxDate={bounds.max} initialReport={data ? mapReport({ ...data, projects: { name: data.project_name } }) : null} timeZone={settings.timeZone} />
    </div>
  )
}
