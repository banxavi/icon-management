import type { AppRole } from '@/lib/types'

/** Directory fields a member may read. No other HR data is shown on the profile. */
export const DIRECTORY_FIELDS = ['fullName', 'role', 'projects', 'email', 'contact', 'skills'] as const

export const MEMBER_EDITABLE_FIELDS = ['contact', 'skills'] as const

export type ProfileField = (typeof DIRECTORY_FIELDS)[number]

export function canEditProfileField(input: {
  actorId: string
  actorRoles: AppRole[]
  targetId: string
  field: ProfileField
  sameTeam: boolean
}): boolean {
  if (input.field === 'contact' || input.field === 'skills') {
    if (input.actorId === input.targetId) return true
    if (input.actorRoles.includes('admin')) return true
    return input.actorRoles.includes('team_leader') && input.sameTeam
  }
  if (input.field === 'fullName') {
    if (input.actorRoles.includes('admin')) return true
    return input.actorRoles.includes('team_leader') && input.sameTeam && input.actorId !== input.targetId
  }
  return false
}
