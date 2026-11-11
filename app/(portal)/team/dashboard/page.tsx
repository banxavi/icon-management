import { requireSession } from '@/lib/auth/session'
import { canViewTeamDashboard } from '@/lib/auth/permissions'
import { Forbidden } from '@/components/forbidden'
import { TeamDashboard } from '@/components/team-dashboard'
import { loadTeamBoard } from '@/app/actions/reports'
import { calendarDateInZone } from '@/lib/reports/window'
import { withAuthUid } from '@/lib/db'

export const dynamic = 'force-dynamic'

export default async function TeamDashboardPage() {
  const session = await requireSession()
  if (!canViewTeamDashboard(session.roles)) {
    try {
      await withAuthUid(
        session.id,
        (sql) => sql`select public.audit_access_denied('page', null, ${JSON.stringify({ path: '/team/dashboard' })}::jsonb)`,
      )
    } catch {
      // ignore
    }
    return <Forbidden />
  }
  const today = calendarDateInZone(new Date())
  const board = await loadTeamBoard(today)
  return <TeamDashboard initialDate={today} initialRows={board.rows} projects={board.projects} />
}
