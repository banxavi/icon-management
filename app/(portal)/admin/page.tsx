import { requireSession } from '@/lib/auth/session'
import { loadAdmin } from '@/lib/data/load'
import { AdminPanel } from '@/components/admin-panel'
import { Forbidden } from '@/components/forbidden'
import { getSql } from '@/lib/db'

export const dynamic = 'force-dynamic'

export default async function AdminPage() {
  const session = await requireSession()
  if (!session.roles.includes('admin')) {
    const sql = getSql()
    if (sql) {
      try {
        await sql`select public.audit_access_denied('page', null, ${JSON.stringify({ path: '/admin' })}::jsonb)`
      } catch {
        // ignore
      }
    }
    return <Forbidden />
  }
  const data = await loadAdmin()
  return <AdminPanel users={data.users} projects={data.projects} settings={data.settings} />
}
