import { describe, expect, it } from 'vitest'
import { canEditProfileField, DIRECTORY_FIELDS, MEMBER_EDITABLE_FIELDS } from '@/lib/auth/profile'

describe('profile fields', () => {
  it('shows only the directory fields and lets a member edit contact and skills', () => {
    expect(DIRECTORY_FIELDS).toEqual(['fullName', 'role', 'projects', 'email', 'contact', 'skills'])
    expect(MEMBER_EDITABLE_FIELDS).toEqual(['contact', 'skills'])
    expect(canEditProfileField({
      actorId: 'm',
      actorRoles: ['member'],
      targetId: 'm',
      field: 'contact',
      sameTeam: true,
    })).toBe(true)
    expect(canEditProfileField({
      actorId: 'm',
      actorRoles: ['member'],
      targetId: 'm',
      field: 'fullName',
      sameTeam: true,
    })).toBe(false)
    expect(canEditProfileField({
      actorId: 'm',
      actorRoles: ['member'],
      targetId: 'm',
      field: 'email',
      sameTeam: true,
    })).toBe(false)
    expect(canEditProfileField({
      actorId: 'm',
      actorRoles: ['member'],
      targetId: 'other',
      field: 'skills',
      sameTeam: true,
    })).toBe(false)
  })

  it('lets a team leader rename a teammate and keeps role changes on the admin account tools', () => {
    expect(canEditProfileField({
      actorId: 'leader',
      actorRoles: ['team_leader'],
      targetId: 'm',
      field: 'fullName',
      sameTeam: true,
    })).toBe(true)
    expect(canEditProfileField({
      actorId: 'leader',
      actorRoles: ['team_leader'],
      targetId: 'leader',
      field: 'fullName',
      sameTeam: true,
    })).toBe(false)
    expect(canEditProfileField({
      actorId: 'leader',
      actorRoles: ['team_leader'],
      targetId: 'm',
      field: 'role',
      sameTeam: true,
    })).toBe(false)
    expect(canEditProfileField({
      actorId: 'admin',
      actorRoles: ['admin'],
      targetId: 'admin',
      field: 'fullName',
      sameTeam: false,
    })).toBe(true)
  })
})
