import { describe, expect, it } from 'vitest'
import {
  canAssignRole,
  canEditProfileField,
  DIRECTORY_FIELDS,
  MEMBER_EDITABLE_FIELDS,
} from '@/lib/auth/profile'

describe('profile fields', () => {
  it('lets a member edit every directory field except id (role and projects included)', () => {
    expect(DIRECTORY_FIELDS).toEqual(['fullName', 'role', 'projects', 'email', 'contact', 'skills'])
    expect(MEMBER_EDITABLE_FIELDS).toEqual(['fullName', 'role', 'projects', 'email', 'contact', 'skills'])
    for (const field of MEMBER_EDITABLE_FIELDS) {
      expect(canEditProfileField({
        actorId: 'm',
        actorRoles: ['member'],
        targetId: 'm',
        field,
        sameTeam: true,
      })).toBe(true)
    }
    expect(canEditProfileField({
      actorId: 'm',
      actorRoles: ['member'],
      targetId: 'other',
      field: 'skills',
      sameTeam: true,
    })).toBe(false)
    expect(canEditProfileField({
      actorId: 'm',
      actorRoles: ['member'],
      targetId: 'other',
      field: 'role',
      sameTeam: true,
    })).toBe(false)
  })

  it('lets a team leader edit teammate role and projects, and keeps admin-role assignment gated', () => {
    expect(canEditProfileField({
      actorId: 'leader',
      actorRoles: ['team_leader'],
      targetId: 'm',
      field: 'role',
      sameTeam: true,
    })).toBe(true)
    expect(canEditProfileField({
      actorId: 'leader',
      actorRoles: ['team_leader'],
      targetId: 'm',
      field: 'projects',
      sameTeam: true,
    })).toBe(true)
    expect(canEditProfileField({
      actorId: 'leader',
      actorRoles: ['team_leader'],
      targetId: 'm',
      field: 'email',
      sameTeam: true,
    })).toBe(false)
    expect(canAssignRole({ actorRoles: ['team_leader'], nextRole: 'admin' })).toBe(false)
    expect(canAssignRole({ actorRoles: ['team_leader'], nextRole: 'member' })).toBe(true)
    expect(canAssignRole({ actorRoles: ['admin'], nextRole: 'admin' })).toBe(true)
    expect(canEditProfileField({
      actorId: 'admin',
      actorRoles: ['admin'],
      targetId: 'other',
      field: 'role',
      sameTeam: false,
    })).toBe(true)
  })
})
