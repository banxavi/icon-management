import { cache } from 'react'
import { after } from 'next/server'
import { redirect } from 'next/navigation'
import { isIdle, shouldTouchActivity } from '@/lib/auth/lockout'
import { auth, authReady } from '@/lib/auth/server'
import { getSql } from '@/lib/db'
import type { AppRole, SessionUser } from '@/lib/types'

const ROLE_CODES = new Set<AppRole>(['member', 'team_leader', 'reviewer', 'admin', 'document_owner'])

function asRoles(codes: unknown): AppRole[] {
  if (!Array.isArray(codes)) return []
  return codes.flatMap((code) => (typeof code === 'string' && ROLE_CODES.has(code as AppRole) ? [code as AppRole] : []))
}

export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  try {
    if (!authReady()) return null
    const { data: session } = await auth.getSession()
    const user = session?.user
    if (!user?.id) return null
    const sql = getSql()
    if (!sql) return null
    // One round-trip: profile + roles (avoids sequential profile then roles HTTP calls).
    const rows = await sql`
      select
        p.id,
        p.full_name,
        p.email,
        p.status,
        p.team_id,
        p.contact,
        p.skills,
        p.last_activity_at,
        r.code as role_code
      from public.profiles p
      left join public.user_roles ur on ur.user_id = p.id
      left join public.roles r on r.id = ur.role_id
      where p.id = ${user.id}::uuid
    `
    const profile = rows[0]
    if (!profile) return null
    const roleCodes = rows.map((row) => row.role_code).filter(Boolean)
    return {
      id: String(profile.id),
      email: String(profile.email),
      fullName: String(profile.full_name),
      status: profile.status === 'inactive' ? 'inactive' : 'active',
      teamId: profile.team_id ? String(profile.team_id) : null,
      contact: typeof profile.contact === 'string' ? profile.contact : '',
      skills: Array.isArray(profile.skills) ? profile.skills.map(String) : [],
      roles: asRoles(roleCodes),
      lastActivityAt: profile.last_activity_at ? String(profile.last_activity_at) : null,
    }
  } catch {
    return null
  }
})

export const requireSession = cache(async (): Promise<SessionUser> => {
  const session = await getSessionUser()
  if (!session) redirect('/login')
  if (session.status !== 'active') redirect('/auth/session-ended?error=deactivated')
  const now = new Date()
  if (isIdle(session.lastActivityAt, now)) redirect('/auth/session-ended?error=idle')
  const sql = getSql()
  if (sql && shouldTouchActivity(session.lastActivityAt, now)) {
    // Do not block the navigation RSC on the activity write.
    after(async () => {
      try {
        await sql`
          update public.profiles
          set last_activity_at = ${now.toISOString()}::timestamptz
          where id = ${session.id}::uuid
        `
      } catch {
        // ignore — idle tracking is best-effort
      }
    })
  }
  return session
})
