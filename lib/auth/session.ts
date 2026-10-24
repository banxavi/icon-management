import { cache } from 'react'
import { redirect } from 'next/navigation'
import { isIdle, shouldTouchActivity } from '@/lib/auth/lockout'
import { createClient } from '@/lib/supabase/server'
import type { AppRole, SessionUser } from '@/lib/types'

const ROLE_CODES = new Set<AppRole>(['member', 'team_leader', 'reviewer', 'admin', 'document_owner'])

function asRoles(value: unknown): AppRole[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((row) => {
    const code = (row as { roles?: { code?: string } | { code?: string }[] | null }).roles
    const raw = Array.isArray(code) ? code[0]?.code : code?.code
    return raw && ROLE_CODES.has(raw as AppRole) ? [raw as AppRole] : []
  })
}

export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  try {
    const supabase = await createClient()
    if (!supabase) return null
    const { data: auth } = await supabase.auth.getUser()
    if (!auth.user) return null
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, full_name, email, status, team_id, contact, skills, last_activity_at')
      .eq('id', auth.user.id)
      .maybeSingle()
    if (!profile) return null
    const { data: roleRows } = await supabase.from('user_roles').select('roles(code)').eq('user_id', auth.user.id)
    return {
      id: profile.id,
      email: profile.email,
      fullName: profile.full_name,
      status: profile.status === 'inactive' ? 'inactive' : 'active',
      teamId: profile.team_id,
      contact: profile.contact ?? '',
      skills: profile.skills ?? [],
      roles: asRoles(roleRows),
      lastActivityAt: profile.last_activity_at,
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
  const supabase = await createClient()
  if (supabase && shouldTouchActivity(session.lastActivityAt, now)) {
    await supabase.from('profiles').update({ last_activity_at: now.toISOString() }).eq('id', session.id)
  }
  return session
}
