import type { AppRole } from '@/lib/types'

const ROLE_RANK: AppRole[] = ['admin', 'team_leader', 'reviewer', 'document_owner', 'member']

export function canSubmitReport(roles: AppRole[]): boolean {
  return roles.includes('member') || roles.includes('team_leader') || roles.includes('document_owner')
}

/** Team dashboard is Team Leader only. Reviewer, Member, Admin, and Document Owner are denied. */
export function canViewTeamDashboard(roles: AppRole[]): boolean {
  return roles.includes('team_leader')
}

export function canReadReport(input: {
  viewerId: string
  viewerRoles: AppRole[]
  ownerId: string
  assignedMemberIds: string[]
  sameTeam: boolean
}): boolean {
  if (input.viewerId === input.ownerId) return true
  if (input.viewerRoles.includes('team_leader') && input.sameTeam) return true
  if (input.viewerRoles.includes('reviewer') && input.assignedMemberIds.includes(input.ownerId)) return true
  if (input.viewerRoles.includes('admin')) return true
  return false
}

export function canEditReport(input: { viewerId: string; viewerRoles: AppRole[]; ownerId: string }): boolean {
  return input.viewerId === input.ownerId && canSubmitReport(input.viewerRoles)
}

export function primaryRole(roles: AppRole[]): AppRole {
  return ROLE_RANK.find((role) => roles.includes(role)) ?? 'member'
}

export function roleLabel(role: AppRole): string {
  switch (role) {
    case 'team_leader':
      return 'Team Leader'
    case 'document_owner':
      return 'Document Owner'
    case 'reviewer':
      return 'Reviewer'
    case 'admin':
      return 'Admin'
    case 'member':
      return 'Member'
  }
}
