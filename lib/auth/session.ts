import { cache } from 'react'
import { redirect } from 'next/navigation'
import { isIdle, shouldTouchActivity } from '@/lib/auth/lockout'
import { auth, authReady } from '@/lib/auth/server'
import { getSql } from '@/lib/db'
import type { AppRole, SessionUser } from '@/lib/types'

const ROLE_CODES = new Set<AppRole>(['member', 'team_leader', 'reviewer', 'admin', 'document_owner'])

function asRoles(rows: { code: string | null }[] | null | undefined): AppRole[] {
  if (!rows) return []
  return rows.flatMap((row) => (row.code && ROLE_CODES.has(row.code as AppRole) ? [row.code as AppRole] : []))
}

export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  try {
    if (!authReady()) return null
    const { data: session } = await auth.getSession()
    const user = session?.user
    if (!user?.id) return null
    const sql = getSql()
    if (!sql) return null
    const profiles = await sql`
      select id, full_name, email, status, team_id, contact, skills, last_activity_at
      from public.profiles
      where id = ${user.id}::uuid
      limit 1
    `
    const profile = profiles[0]
    if (!profile) return null
    const roleRows = await sql`
      select r.code
      from public.user_roles ur
      join public.roles r on r.id = ur.role_id
      where ur.user_id = ${user.id}::uuid
    `
    return {
      id: String(profile.id),
      email: String(profile.email),
      fullName: String(profile.full_name),
      status: profile.status === 'inactive' ? 'inactive' : 'active',
      teamId: profile.team_id ? String(profile.team_id) : null,
      contact: typeof profile.contact === 'string' ? profile.contact : '',
      skills: Array.isArray(profile.skills) ? profile.skills.map(String) : [],
      roles: asRoles(roleRows as { code: string | null }[]),
      lastActivityAt: profile.last_activity_at ? String(profile.last_activity_at) : null,
    }
  } catch {
    return null
  }
})

export async function requireSession(): Promise<SessionUser> {
  const session = await getSessionUser()
  if (!session) redirect('/login')
  if (session.status !== 'active') redirect('/auth/session-ended?error=deactivated')
  const now = new Date()
  if (isIdle(session.lastActivityAt, now)) redirect('/auth/session-ended?error=idle')
  const sql = getSql()
  if (sql && shouldTouchActivity(session.lastActivityAt, now)) {
    await sql`
      update public.profiles
      set last_activity_at = ${now.toISOString()}::timestamptz
      where id = ${session.id}::uuid
    `
  }
  return session
}
