import { requireSession } from '@/lib/auth/session'
import { loadAdmin } from '@/lib/data/load'
import { AdminPanel } from '@/components/admin-panel'
import { Forbidden } from '@/components/forbidden'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function AdminPage() {
  const session = await requireSession()
  if (!session.roles.includes('admin')) {
    const supabase = await createClient()
    await supabase?.rpc('audit_access_denied', {
      p_object_type: 'page',
      p_object_id: null,
      p_metadata: { path: '/admin' },
    })
    return <Forbidden />
  }
  const data = await loadAdmin()
  return <AdminPanel users={data.users} projects={data.projects} settings={data.settings} />
}
