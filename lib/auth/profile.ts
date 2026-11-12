import type { AppRole } from '@/lib/types'

/** Directory fields a member may read. No other HR data is shown on the profile. */
export const DIRECTORY_FIELDS = ['fullName', 'role', 'projects', 'email', 'contact', 'skills'] as const

/**
 * Profile fields an employee may update on their record.
 * `id` is intentionally excluded and must stay read-only / non-mutable.
 */
export const MEMBER_EDITABLE_FIELDS = ['fullName', 'role', 'projects', 'email', 'contact', 'skills'] as const

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

  if (input.field === 'contact' || input.field === 'skills' || input.field === 'projects') {
    if (isSelf) return true
    if (isAdmin) return true
    return isTeamLeader
  }

  if (input.field === 'fullName') {
    if (isSelf) return true
    if (isAdmin) return true
    return isTeamLeader
  }

  if (input.field === 'email') {
    if (isSelf) return true
    return isAdmin
  }

  // Role is sensitive: self, admin, or team leader (teammate). Assigning admin is gated separately.
  if (input.field === 'role') {
    if (isSelf) return true
    if (isAdmin) return true
    return isTeamLeader
  }

  return false
}

/** Only admins may grant the admin role (matches admin account tools). */
export function canAssignRole(input: {
  actorRoles: AppRole[]
  nextRole: AppRole
}): boolean {
  if (input.nextRole === 'admin') return input.actorRoles.includes('admin')
  return true
}
