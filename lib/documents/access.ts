import type { AppRole } from '@/lib/types'

export type FolderVisibility = 'team' | 'restricted'

/**
 * Folder view rules. Keep in step with public.can_view_folder.
 * Members see team folders and explicit grants. Reviewer, document owner,
 * and team leader see every folder on their team. Admin sees all.
 */
export function canViewFolder(input: {
  roles: AppRole[]
  sameTeam: boolean
  active: boolean
  visibility: FolderVisibility
  hasViewGrant: boolean
  hasManageGrant: boolean
}): boolean {
  if (!input.active) return false
  if (input.roles.includes('admin')) return true
  if (input.hasViewGrant || input.hasManageGrant) return true
  if (!input.sameTeam) return false
  if (input.roles.includes('team_leader') || input.roles.includes('reviewer') || input.roles.includes('document_owner')) {
    return true
  }
  return input.visibility === 'team' && input.roles.includes('member')
}

/** Upload and version restore. Keep in step with public.can_manage_folder. */
export function canManageFolder(input: {
  roles: AppRole[]
  sameTeam: boolean
  active: boolean
  hasManageGrant: boolean
}): boolean {
  if (!input.active) return false
  if (input.roles.includes('admin')) return true
  if (input.roles.includes('team_leader') && input.sameTeam) return true
  return input.roles.includes('document_owner') && input.hasManageGrant
}

export function canAdministerFolders(roles: AppRole[]): boolean {
  return roles.includes('admin') || roles.includes('team_leader')
}
