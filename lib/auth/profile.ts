import type { AppRole } from '@/lib/types'

/** Directory fields a member may read. No other HR data is shown on the profile. */
export const DIRECTORY_FIELDS = ['fullName', 'role', 'projects', 'email', 'contact', 'skills'] as const

/**
 * Profile columns an employee may update on their own record.
 * `id` is intentionally excluded and must stay read-only / non-mutable.
 * Role and projects stay on the admin account tools (join tables, not profile columns).
 */
export const MEMBER_EDITABLE_FIELDS = ['fullName', 'email', 'contact', 'skills'] as const

export type ProfileField = (typeof DIRECTORY_FIELDS)[number]

export function canEditProfileField(input: {
  actorId: string
  actorRoles: AppRole[]
  targetId: string
  field: ProfileField
  sameTeam: boolean
}): boolean {
  const isSelf = input.actorId === input.targetId
  const isAdmin = input.actorRoles.includes('admin')
  const isTeamLeader = input.actorRoles.includes('team_leader') && input.sameTeam

  if (input.field === 'contact' || input.field === 'skills') {
    if (isSelf) return true
    if (isAdmin) return true
    return isTeamLeader
  }

  if (input.field === 'fullName') {
    if (isSelf) return true
    if (isAdmin) return true
    return isTeamLeader && !isSelf
  }

  if (input.field === 'email') {
    if (isSelf) return true
    return isAdmin
  }

  // role / projects are assigned through admin tools, not the profile form
  return false
}
