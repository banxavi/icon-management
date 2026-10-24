import { requireSession } from '@/lib/auth/session'
import { canSubmitReport } from '@/lib/auth/permissions'
import { loadProjects } from '@/lib/data/load'
import { Forbidden } from '@/components/forbidden'
import { DailyReportForm } from '@/components/daily-report-form'
import { createClient } from '@/lib/supabase/server'
import { mapReport } from '@/lib/data/rows'
import { calendarDateInZone, openReportDateBounds } from '@/lib/reports/window'

export const dynamic = 'force-dynamic'

export default async function NewDailyReportPage() {
  const session = await requireSession()
  if (!canSubmitReport(session.roles)) return <Forbidden />
  const now = new Date()
  const bounds = openReportDateBounds(now)
  const today = calendarDateInZone(now)
  const projects = await loadProjects(session)
  const supabase = await createClient()
  const { data } = supabase
    ? await supabase.from('daily_reports').select('*, projects(name)').eq('user_id', session.id).eq('report_date', today).maybeSingle()
    : { data: null }
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <p className="text-sm font-medium text-[#e2894b]">DAILY REPORT</p>
        <h1 className="mt-1 text-3xl font-semibold">Submit a daily report</h1>
        <p className="mt-2 text-slate-500">Share a short update so the team can see progress. Declare WFH here, with a reason.</p>
      </div>
      <DailyReportForm projects={projects} initialDate={today} minDate={bounds.min} maxDate={bounds.max} initialReport={data ? mapReport(data as Record<string, unknown>) : null} />
    </div>
  )
}
