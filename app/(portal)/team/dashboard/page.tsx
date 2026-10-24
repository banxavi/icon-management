import { requireSession } from '@/lib/auth/session'
import { canViewTeamDashboard } from '@/lib/auth/permissions'
import { Forbidden } from '@/components/forbidden'
import { TeamDashboard } from '@/components/team-dashboard'
import { loadTeamBoard } from '@/app/actions/reports'
import { calendarDateInZone } from '@/lib/reports/window'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function TeamDashboardPage() {
  const session = await requireSession()
  if (!canViewTeamDashboard(session.roles)) {
    const supabase = await createClient()
    await supabase?.rpc('audit_access_denied', {
      p_object_type: 'page',
      p_object_id: null,
      p_metadata: { path: '/team/dashboard' },
    })
    return <Forbidden />
  }
  const today = calendarDateInZone(new Date())
  const board = await loadTeamBoard(today)
  return <TeamDashboard initialDate={today} initialRows={board.rows} projects={board.projects} />
}
