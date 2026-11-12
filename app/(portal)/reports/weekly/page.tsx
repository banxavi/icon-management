import { loadWeeklyContext } from '@/app/actions/reports'
import { WeeklyReportForm } from '@/components/weekly-report-form'
import { Forbidden } from '@/components/forbidden'
import { PageHeader } from '@/components/layout'
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
      <PageHeader eyebrow="Weekly report" title="Weekly summary" description="Write one report for the week. Highlights can start from your daily Done today notes." />
      <WeeklyReportForm initial={result.context} />
    </div>
  )
}
