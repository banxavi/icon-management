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

  // Role control is shown to self / admin / team leader; assignment rules are in canAssignRole.
  if (input.field === 'role') {
    if (isSelf) return true
    if (isAdmin) return true
    return isTeamLeader
  }

  return false
}

/**
 * Who may assign which role. Matches admin account tools for privilege:
 * - Leaving the current role unchanged is always allowed (keeps the select/default stable).
 * - Admins may assign any role.
 * - Team leaders may change a non-admin to member / reviewer / document_owner
 *   (not admin or team_leader), and may not demote an admin.
 * - Everyone else may only leave the current role unchanged (no self-escalation).
 */
export function canAssignRole(input: {
  actorRoles: AppRole[]
  nextRole: AppRole
  currentRole: AppRole
}): boolean {
  if (input.nextRole === input.currentRole) return true
  if (input.actorRoles.includes('admin')) return true
  if (input.currentRole === 'admin') return false
  if (input.actorRoles.includes('team_leader')) {
    return input.nextRole === 'member' || input.nextRole === 'reviewer' || input.nextRole === 'document_owner'
  }
  return false
}
