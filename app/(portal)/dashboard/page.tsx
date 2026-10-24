import { requireSession } from '@/lib/auth/session'
import { canSubmitReport, canViewTeamDashboard } from '@/lib/auth/permissions'
import { loadHome } from '@/lib/data/load'
import { DashboardHome } from '@/components/dashboard-home'
import { formatLongDate } from '@/lib/reports/window'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const session = await requireSession()
  const home = await loadHome(session)
  const today = new Date(`${home.today}T12:00:00+07:00`)
  return (
    <DashboardHome
      todayLabel={formatLongDate(today)}
      report={home.report}
      week={home.week}
      canSubmit={canSubmitReport(session.roles)}
      isReviewer={session.roles.includes('reviewer')}
      isLeader={canViewTeamDashboard(session.roles)}
      isAdmin={session.roles.includes('admin')}
      assigned={home.assigned}
    />
  )
}
