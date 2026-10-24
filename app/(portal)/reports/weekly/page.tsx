import { loadWeeklyContext } from '@/app/actions/reports'
import { WeeklyReportForm } from '@/components/weekly-report-form'
import { Forbidden } from '@/components/forbidden'
import { canSubmitReport } from '@/lib/auth/permissions'
import { requireSession } from '@/lib/auth/session'

export const dynamic = 'force-dynamic'

export default async function WeeklyReportPage() {
  const session = await requireSession()
  if (!canSubmitReport(session.roles)) return <Forbidden />
  const result = await loadWeeklyContext()
  if (!result.ok) return <p className="text-sm text-red-700">{result.error}</p>
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <p className="text-sm font-medium text-[#e2894b]">WEEKLY REPORT</p>
        <h1 className="mt-1 text-3xl font-semibold">Weekly summary</h1>
        <p className="mt-2 text-slate-500">Write one report for the week. Highlights can start from your daily Done today notes.</p>
      </div>
      <WeeklyReportForm initial={result.context} />
    </div>
  )
}
