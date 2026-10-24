import { describe, expect, it } from 'vitest'
import { canAdministerFolders, canManageFolder, canViewFolder } from '@/lib/documents/access'

describe('document folder access', () => {
  it('lets a member view team folders and granted restricted folders only', () => {
    expect(canViewFolder({
      roles: ['member'],
      sameTeam: true,
      active: true,
      visibility: 'team',
      hasViewGrant: false,
      hasManageGrant: false,
    })).toBe(true)
    expect(canViewFolder({
      roles: ['member'],
      sameTeam: true,
      active: true,
      visibility: 'restricted',
      hasViewGrant: false,
      hasManageGrant: false,
    })).toBe(false)
    expect(canViewFolder({
      roles: ['member'],
      sameTeam: true,
      active: true,
      visibility: 'restricted',
      hasViewGrant: true,
      hasManageGrant: false,
    })).toBe(true)
    expect(canManageFolder({ roles: ['member'], sameTeam: true, active: true, hasManageGrant: true })).toBe(false)
  })

  it('lets reviewer and document owner view team folders, and only a granted document owner upload', () => {
    expect(canViewFolder({
      roles: ['reviewer'],
      sameTeam: true,
      active: true,
      visibility: 'restricted',
      hasViewGrant: false,
      hasManageGrant: false,
    })).toBe(true)
    expect(canManageFolder({ roles: ['reviewer'], sameTeam: true, active: true, hasManageGrant: false })).toBe(false)
    expect(canViewFolder({
      roles: ['document_owner'],
      sameTeam: true,
      active: true,
      visibility: 'restricted',
      hasViewGrant: false,
      hasManageGrant: false,
    })).toBe(true)
    expect(canManageFolder({ roles: ['document_owner'], sameTeam: true, active: true, hasManageGrant: false })).toBe(false)
    expect(canManageFolder({ roles: ['document_owner'], sameTeam: true, active: true, hasManageGrant: true })).toBe(true)
  })

  it('lets the team leader and admin manage folders, and keeps an inactive user out', () => {
    expect(canManageFolder({ roles: ['team_leader'], sameTeam: true, active: true, hasManageGrant: false })).toBe(true)
    expect(canManageFolder({ roles: ['team_leader'], sameTeam: false, active: true, hasManageGrant: false })).toBe(false)
    expect(canViewFolder({
      roles: ['admin'],
      sameTeam: false,
      active: true,
      visibility: 'restricted',
      hasViewGrant: false,
      hasManageGrant: false,
    })).toBe(true)
    expect(canViewFolder({
      roles: ['member'],
      sameTeam: true,
      active: false,
      visibility: 'team',
      hasViewGrant: true,
      hasManageGrant: false,
    })).toBe(false)
    expect(canAdministerFolders(['team_leader'])).toBe(true)
    expect(canAdministerFolders(['document_owner'])).toBe(false)
  })
})
