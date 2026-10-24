import { describe, expect, it } from 'vitest'
import { canEditReport, canReadReport, canSubmitReport, canViewTeamDashboard } from '@/lib/auth/permissions'

describe('role permissions', () => {
  it('lets a member read only their own report', () => {
    expect(canReadReport({
      viewerId: 'a',
      viewerRoles: ['member'],
      ownerId: 'b',
      assignedMemberIds: [],
      sameTeam: true,
    })).toBe(false)
    expect(canReadReport({
      viewerId: 'a',
      viewerRoles: ['member'],
      ownerId: 'a',
      assignedMemberIds: [],
      sameTeam: true,
    })).toBe(true)
  })

  it('lets a reviewer read only assigned members and never edit', () => {
    expect(canReadReport({
      viewerId: 'r',
      viewerRoles: ['reviewer'],
      ownerId: 'x',
      assignedMemberIds: ['x'],
      sameTeam: true,
    })).toBe(true)
    expect(canReadReport({
      viewerId: 'r',
      viewerRoles: ['reviewer'],
      ownerId: 'y',
      assignedMemberIds: ['x'],
      sameTeam: true,
    })).toBe(false)
    expect(canEditReport({ viewerId: 'r', viewerRoles: ['reviewer'], ownerId: 'x' })).toBe(false)
    expect(canSubmitReport(['reviewer'])).toBe(false)
  })

  it('opens the team dashboard to the team leader only', () => {
    expect(canViewTeamDashboard(['team_leader'])).toBe(true)
    expect(canViewTeamDashboard(['reviewer'])).toBe(false)
    expect(canViewTeamDashboard(['member'])).toBe(false)
    expect(canViewTeamDashboard(['admin'])).toBe(false)
    expect(canViewTeamDashboard(['document_owner'])).toBe(false)
  })
})
