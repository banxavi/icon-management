'use server'

import { revalidatePath } from 'next/cache'
import { parseMemberCsv } from '@/lib/admin/csv'
import { parseOrgSettings } from '@/lib/admin/settings'
import { primaryRole } from '@/lib/auth/permissions'
import { canAssignRole, canEditProfileField } from '@/lib/auth/profile'
import { clientIp } from '@/lib/auth/request'
import { requireSession } from '@/lib/auth/session'
import { auth, authReady } from '@/lib/auth/server'
import { TEAM_ID } from '@/lib/constants'
import { asRole } from '@/lib/data/rows'
import { getSql, withAuthUid } from '@/lib/db'
import { siteUrl } from '@/lib/env'
import { messages } from '@/lib/messages'
import { ROLE_CODES, type AppRole } from '@/lib/types'

export type AdminResult = { ok: true; message: string } | { ok: false; errors: string[] }

async function requireAdmin() {
  const session = await requireSession()
  if (!session.roles.includes('admin')) {
    try {
      await withAuthUid(
        session.id,
        (sql) => sql`select public.audit_access_denied('page', null, ${JSON.stringify({ path: '/admin' })}::jsonb)`,
      )
    } catch {
      // ignore
    }
    return null
  }
  return session
}

async function findUserIdByEmail(email: string): Promise<{ id: string | null; hasProfile: boolean; error?: string }> {
  const sql = getSql()
  if (!sql) return { id: null, hasProfile: false, error: 'Database is not configured.' }
  const rows = await sql`select id from neon_auth."user" where lower(email) = ${email.toLowerCase()} limit 1`
  if (rows[0]?.id) {
    const authId = String(rows[0].id)
    const profile = await sql`select 1 from public.profiles where id = ${authId}::uuid limit 1`
    return { id: authId, hasProfile: Boolean(profile[0]) }
  }
  const profile = await sql`select id from public.profiles where lower(email) = ${email.toLowerCase()} limit 1`
  return { id: profile[0]?.id ? String(profile[0].id) : null, hasProfile: Boolean(profile[0]?.id) }
}

async function sendInvitePasswordReset(email: string): Promise<string | null> {
  const reset = await auth.requestPasswordReset({
    email,
    redirectTo: `${siteUrl()}/login/update-password`,
  })
  if (reset.error) {
    return reset.error.message || 'unknown error'
  }
  return null
}

async function applyRole(userId: string, role: AppRole, assignedMemberIds?: string[]) {
  const sql = getSql()
  if (!sql) return 'Database is not configured.'
  const roleRows = await sql`select id from public.roles where code = ${role} limit 1`
  if (!roleRows[0]) return `Could not find the ${role} role.`

  await sql`update public.profiles set team_id = ${TEAM_ID}::uuid where id = ${userId}::uuid`
  await sql`delete from public.user_roles where user_id = ${userId}::uuid`
  await sql`insert into public.user_roles (user_id, role_id) values (${userId}::uuid, ${roleRows[0].id}::uuid)`

  if (role === 'team_leader') {
    await sql`update public.teams set leader_id = ${userId}::uuid where id = ${TEAM_ID}::uuid`
  }
  if (role !== 'reviewer') {
    await sql`delete from public.reviewer_assignments where reviewer_id = ${userId}::uuid`
  } else if (assignedMemberIds) {
    await sql`delete from public.reviewer_assignments where reviewer_id = ${userId}::uuid`
    for (const memberId of assignedMemberIds.filter((id) => id !== userId)) {
      await sql`
        insert into public.reviewer_assignments (reviewer_id, member_id)
        values (${userId}::uuid, ${memberId}::uuid)
      `
    }
  }
  return null
}

async function resolveProjectIds(projectNames: string[]): Promise<{ ok: true; ids: Map<string, string> } | { ok: false; error: string }> {
  const sql = getSql()
  if (!sql) return { ok: false, error: 'Database is not configured.' }
  if (projectNames.length === 0) return { ok: true, ids: new Map() }
  const projectRows = await sql`select id, name from public.projects where name = any(${projectNames}::text[])`
  const found = new Map(projectRows.map((row) => [String(row.name), String(row.id)]))
  for (const name of projectNames) {
    if (!found.has(name)) return { ok: false, error: `Project "${name}" was not found.` }
  }
  return { ok: true, ids: found }
}

async function applyProjects(userId: string, projectNames: string[], memberRole: AppRole) {
  const sql = getSql()
  if (!sql) return 'Database is not configured.'
  const resolved = await resolveProjectIds(projectNames)
  if (!resolved.ok) return resolved.error

  await sql`delete from public.project_members where user_id = ${userId}::uuid`
  for (const name of projectNames) {
    const projectId = resolved.ids.get(name)!
    await sql`
      insert into public.project_members (user_id, project_id, member_role)
      values (${userId}::uuid, ${projectId}::uuid, ${memberRole})
    `
  }
  return null
}

async function applyMembership(userId: string, role: AppRole, projectName: string, assignedMemberIds?: string[]) {
  // Validate the project exists before rewriting roles / team leadership.
  const resolved = await resolveProjectIds([projectName])
  if (!resolved.ok) return resolved.error
  const roleError = await applyRole(userId, role, assignedMemberIds)
  if (roleError) return roleError
  return applyProjects(userId, [projectName], role)
}

function sameProjectSet(a: string[], b: string[]) {
  if (a.length !== b.length) return false
  const left = [...a].sort()
  const right = [...b].sort()
  return left.every((name, index) => name === right[index])
}

export async function importMembers(_prev: AdminResult | null, formData: FormData): Promise<AdminResult> {
  const session = await requireAdmin()
  if (!session) return { ok: false, errors: [messages.forbidden] }
  if (!authReady()) return { ok: false, errors: [messages.importNeedsServer] }
  const sql = getSql()
  if (!sql) return { ok: false, errors: [messages.importNeedsServer] }

  const file = formData.get('file')
  const text = file instanceof File ? await file.text() : String(formData.get('csv') || '')
  const projects = await sql`select name from public.projects`
  const parsed = parseMemberCsv(text, projects.map((project) => String(project.name)))
  if (!parsed.ok) return { ok: false, errors: parsed.errors }

  const errors: string[] = []
  for (const row of parsed.rows) {
    const located = await findUserIdByEmail(row.email)
    if (located.error) {
      errors.push(`Row ${row.line}: ${located.error}`)
      continue
    }
    let userId = located.id
    const needsInvite = !userId || !located.hasProfile
    if (!userId) {
      const created = await auth.admin.createUser({
        email: row.email,
        name: row.fullName,
        password: `${crypto.randomUUID().replace(/-/g, '')}Aa1!`,
      })
      const createdUser = (created.data as { user?: { id?: string } } | null | undefined)?.user
      if (created.error || !createdUser?.id) {
        errors.push(`Row ${row.line}: ${created.error?.message ?? 'Could not create the account.'}`)
        continue
      }
      userId = createdUser.id
    }
    // New auth users and retries for auth-without-profile must (re)send the invite reset.
    // Never upsert a profile if the reset email failed — that would report success with no way to sign in.
    if (needsInvite) {
      const resetError = await sendInvitePasswordReset(row.email)
      if (resetError) {
        errors.push(
          `Row ${row.line}: ${located.hasProfile === false && located.id ? 'auth user exists but ' : ''}password reset email failed (${resetError}). Re-import after fixing email delivery.`,
        )
        continue
      }
    }
    try {
      await sql`
        insert into public.profiles (id, full_name, email, team_id, status)
        values (${userId}::uuid, ${row.fullName}, ${row.email}, ${TEAM_ID}::uuid, 'active')
        on conflict (id) do update set
          full_name = excluded.full_name,
          email = excluded.email,
          team_id = excluded.team_id,
          status = 'active',
          updated_at = now()
      `
    } catch (error) {
      errors.push(`Row ${row.line}: ${error instanceof Error ? error.message : messages.saveFailed}`)
      continue
    }
    const membershipError = await applyMembership(userId, row.role, row.project)
    if (membershipError) errors.push(`Row ${row.line}: ${membershipError}`)
  }

  await sql`
    insert into public.audit_logs (actor_id, action, object_type, metadata)
    values (
      ${session.id}::uuid,
      'users_imported',
      'profile',
      ${JSON.stringify({ rows: parsed.rows.length, ip: await clientIp() })}::jsonb
    )
  `
  revalidatePath('/admin')
  revalidatePath('/team/directory')
  if (errors.length > 0) return { ok: false, errors }
  return { ok: true, message: `Imported ${parsed.rows.length} users. Reviewer assignments can be set on each reviewer.` }
}

export async function updateAccount(formData: FormData): Promise<AdminResult> {
  const session = await requireAdmin()
  if (!session) return { ok: false, errors: [messages.forbidden] }
  const sql = getSql()
  if (!sql) return { ok: false, errors: [messages.importNeedsServer] }

  const userId = String(formData.get('userId') || '')
  const role = String(formData.get('role') || '') as AppRole
  const project = String(formData.get('project') || '')
  const assigned = formData.getAll('assigned').map(String)
  const membershipError = await applyMembership(userId, role, project, assigned)
  if (membershipError) return { ok: false, errors: [membershipError] }
  await sql`
    insert into public.audit_logs (actor_id, action, object_type, object_id, metadata)
    values (
      ${session.id}::uuid,
      'role_assigned',
      'profile',
      ${userId}::uuid,
      ${JSON.stringify({ role, project, assigned })}::jsonb
    )
  `
  revalidatePath('/admin')
  return { ok: true, message: messages.roleSaved }
}

export async function setAccountActive(formData: FormData): Promise<AdminResult> {
  const session = await requireAdmin()
  if (!session) return { ok: false, errors: [messages.forbidden] }
  if (!authReady()) return { ok: false, errors: [messages.importNeedsServer] }
  const sql = getSql()
  if (!sql) return { ok: false, errors: [messages.importNeedsServer] }
  const userId = String(formData.get('userId') || '')
  const active = String(formData.get('active') || '') === 'true'
  const banResult = active
    ? await auth.admin.unbanUser({ userId })
    : await auth.admin.banUser({ userId, banReason: 'Deactivated by admin' })
  if (banResult.error) return { ok: false, errors: [banResult.error.message || 'Could not update account access.'] }
  await sql`update public.profiles set status = ${active ? 'active' : 'inactive'} where id = ${userId}::uuid`
  await sql`
    insert into public.audit_logs (actor_id, action, object_type, object_id, metadata)
    values (
      ${session.id}::uuid,
      ${active ? 'user_reactivated' : 'user_deactivated'},
      'profile',
      ${userId}::uuid,
      '{}'::jsonb
    )
  `
  revalidatePath('/admin')
  return { ok: true, message: active ? messages.reactivatedOk : messages.deactivatedOk }
}

export async function updateOrgSettings(formData: FormData): Promise<AdminResult> {
  const session = await requireAdmin()
  if (!session) return { ok: false, errors: [messages.forbidden] }
  const parsed = parseOrgSettings({
    timezone: String(formData.get('timezone') || ''),
    retentionMonths: String(formData.get('retentionMonths') || ''),
    dailyWindow: String(formData.get('dailyWindow') || ''),
    maxUploadMb: String(formData.get('maxUploadMb') || ''),
    extensions: formData.getAll('extensions').map(String),
    weeklyDeadlineWeekday: String(formData.get('weeklyDeadlineWeekday') || ''),
    weeklyDeadlineTime: String(formData.get('weeklyDeadlineTime') || ''),
  })
  if (!parsed.ok) return parsed
  const sql = getSql()
  if (!sql) return { ok: false, errors: [messages.saveFailed] }
  const current = await sql`select id from public.org_settings limit 1`
  if (!current[0]) return { ok: false, errors: [messages.saveFailed] }
  try {
    await sql`
      update public.org_settings set
        timezone = ${parsed.value.timezone},
        retention_months = ${parsed.value.retentionMonths},
        daily_window = ${parsed.value.dailyWindow},
        max_upload_mb = ${parsed.value.maxUploadMb},
        allowed_extensions = ${parsed.value.allowedExtensions},
        weekly_deadline_weekday = ${parsed.value.weeklyDeadlineWeekday},
        weekly_deadline_time = ${parsed.value.weeklyDeadlineTime},
        updated_at = ${new Date().toISOString()}::timestamptz
      where id = ${current[0].id}::uuid
    `
  } catch (error) {
    return { ok: false, errors: [error instanceof Error ? error.message : messages.saveFailed] }
  }
  await sql`
    insert into public.audit_logs (actor_id, action, object_type, object_id, metadata)
    values (
      ${session.id}::uuid,
      'org_settings_updated',
      'org_settings',
      ${current[0].id}::uuid,
      ${JSON.stringify(parsed.value)}::jsonb
    )
  `
  revalidatePath('/admin')
  revalidatePath('/documents')
  revalidatePath('/reports/weekly')
  revalidatePath('/reports/weekly/new')
  return { ok: true, message: messages.settingsSaved }
}

export async function updateMemberName(_prev: AdminResult | null, formData: FormData): Promise<AdminResult> {
  const session = await requireSession()
  const userId = String(formData.get('userId') || '')
  const fullName = String(formData.get('fullName') || '').trim()
  if (fullName.length < 2 || fullName.length > 120) {
    return { ok: false, errors: ['Enter a name between 2 and 120 characters.'] }
  }
  const sql = getSql()
  if (!sql) return { ok: false, errors: [messages.saveFailed] }
  const target = await sql`select id, team_id from public.profiles where id = ${userId}::uuid limit 1`
  if (!target[0]) return { ok: false, errors: [messages.forbidden] }
  const allowed = canEditProfileField({
    actorId: session.id,
    actorRoles: session.roles,
    targetId: userId,
    field: 'fullName',
    sameTeam: Boolean(session.teamId && target[0].team_id === session.teamId),
  })
  if (!allowed) return { ok: false, errors: ['Only an Admin or Team Leader can change another member name.'] }
  const updated = await sql`
    update public.profiles set full_name = ${fullName}
    where id = ${userId}::uuid
    returning full_name
  `
  if (!updated[0] || updated[0].full_name !== fullName) return { ok: false, errors: ['That name could not be changed.'] }
  revalidatePath('/team/directory')
  revalidatePath(`/team/${userId}`)
  return { ok: true, message: messages.nameSaved }
}

/** Update employee profile fields. Profile `id` is never accepted for mutation. */
export async function updateEmployeeProfile(_prev: AdminResult | null, formData: FormData): Promise<AdminResult> {
  const session = await requireSession()
  const sql = getSql()
  if (!sql) return { ok: false, errors: [messages.saveFailed] }

  // Target is taken from userId (or self). Profile `id` is never written — reject spoofed id payloads.
  const targetId = String(formData.get('userId') || session.id).trim()
  if (!targetId) return { ok: false, errors: [messages.forbidden] }
  if (formData.has('id')) {
    const spoofedId = String(formData.get('id') || '').trim()
    if (spoofedId && spoofedId !== targetId) {
      return { ok: false, errors: ['Profile ID cannot be changed.'] }
    }
  }

  const target = await sql`select id, team_id, full_name, email, contact, skills from public.profiles where id = ${targetId}::uuid limit 1`
  if (!target[0]) return { ok: false, errors: [messages.forbidden] }

  const sameTeam = Boolean(session.teamId && target[0].team_id === session.teamId)
  const aclBase = {
    actorId: session.id,
    actorRoles: session.roles,
    targetId,
    sameTeam,
  }

  const canFullName = canEditProfileField({ ...aclBase, field: 'fullName' })
  const canEmail = canEditProfileField({ ...aclBase, field: 'email' })
  const canContact = canEditProfileField({ ...aclBase, field: 'contact' })
  const canSkills = canEditProfileField({ ...aclBase, field: 'skills' })
  const canRole = canEditProfileField({ ...aclBase, field: 'role' })
  const canProjects = canEditProfileField({ ...aclBase, field: 'projects' })

  if (!canFullName && !canEmail && !canContact && !canSkills && !canRole && !canProjects) {
    return { ok: false, errors: [messages.forbidden] }
  }

  const existingRoles = await sql`
    select r.code from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = ${targetId}::uuid
  `
  const existingRoleCodes = existingRoles.map((row) => asRole(row.code)).filter((role): role is AppRole => Boolean(role))
  const currentRole = primaryRole(existingRoleCodes)

  const existingProjects = await sql`
    select p.name from public.project_members pm
    join public.projects p on p.id = pm.project_id
    where pm.user_id = ${targetId}::uuid
    order by p.name
  `
  const currentProjects = existingProjects.map((row) => String(row.name))

  const errors: string[] = []
  const fullName = canFullName
    ? String(formData.get('fullName') || '').trim()
    : String(target[0].full_name || '')
  const email = canEmail
    ? String(formData.get('email') || '').trim().toLowerCase()
    : String(target[0].email || '').toLowerCase()
  const contact = canContact
    ? String(formData.get('contact') || '').trim()
    : (typeof target[0].contact === 'string' ? target[0].contact : '')
  const skills = canSkills
    ? String(formData.get('skills') || '')
      .split(',')
      .map((skill) => skill.trim())
      .filter(Boolean)
    : (Array.isArray(target[0].skills) ? target[0].skills.map(String) : [])
  const nextRole = canRole ? asRole(String(formData.get('role') || '')) : currentRole
  const nextProjects = canProjects
    ? formData.getAll('projects').map(String).map((name) => name.trim()).filter(Boolean)
    : currentProjects

  if (canFullName && (fullName.length < 2 || fullName.length > 120)) {
    errors.push('Enter a name between 2 and 120 characters.')
  }
  if (canEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.push('Enter a valid email address.')
  }
  if (canContact && contact.length > 200) {
    errors.push('Contact must be at most 200 characters.')
  }
  if (canSkills && skills.length > 24) {
    errors.push('Use at most 24 skills.')
  }
  if (canSkills && skills.some((skill) => skill.length > 40)) {
    errors.push('Each skill must be at most 40 characters.')
  }
  const roleChanged = Boolean(canRole && nextRole && nextRole !== currentRole)
  const projectsChanged = canProjects && !sameProjectSet(nextProjects, currentProjects)

  if (canRole) {
    if (!nextRole || !ROLE_CODES.includes(nextRole)) {
      errors.push('Choose a valid role.')
    } else if (
      !canAssignRole({ actorRoles: session.roles, nextRole, currentRole })
    ) {
      errors.push('You do not have permission to assign that role.')
    }
  }
  if (errors.length > 0) return { ok: false, errors }

  if (canProjects && projectsChanged) {
    const resolved = await resolveProjectIds(nextProjects)
    if (!resolved.ok) return { ok: false, errors: [resolved.error] }
  }

  if (canEmail && email !== String(target[0].email || '').toLowerCase()) {
    const taken = await sql`
      select id from public.profiles
      where lower(email) = ${email} and id is distinct from ${targetId}::uuid
      limit 1
    `
    if (taken[0]) return { ok: false, errors: ['That email is already used by another account.'] }
  }

  try {
    if (canEmail && email !== String(target[0].email || '').toLowerCase()) {
      await sql`update neon_auth."user" set email = ${email} where id = ${targetId}::uuid`
      try {
        await sql`update auth.users set email = ${email} where id = ${targetId}::uuid`
      } catch {
        // auth.users is a bootstrap stub; ignore when the row is missing
      }
    }
    await sql`
      update public.profiles set
        full_name = ${fullName},
        email = ${email},
        contact = ${contact},
        skills = ${skills},
        updated_at = now()
      where id = ${targetId}::uuid
    `

    const roleForProjects = nextRole ?? currentRole
    if (roleChanged && nextRole) {
      const roleError = await applyRole(targetId, nextRole)
      if (roleError) return { ok: false, errors: [roleError] }
      await sql`
        insert into public.audit_logs (actor_id, action, object_type, object_id, metadata)
        values (
          ${session.id}::uuid,
          'role_assigned',
          'profile',
          ${targetId}::uuid,
          ${JSON.stringify({ role: nextRole, previousRole: currentRole })}::jsonb
        )
      `
    }
    if (projectsChanged) {
      const projectError = await applyProjects(targetId, nextProjects, roleForProjects)
      if (projectError) return { ok: false, errors: [projectError] }
      await sql`
        insert into public.audit_logs (actor_id, action, object_type, object_id, metadata)
        values (
          ${session.id}::uuid,
          'projects_updated',
          'profile',
          ${targetId}::uuid,
          ${JSON.stringify({ projects: nextProjects, previousProjects: currentProjects })}::jsonb
        )
      `
    }
  } catch (error) {
    return { ok: false, errors: [error instanceof Error ? error.message : messages.saveFailed] }
  }

  revalidatePath('/team/directory')
  revalidatePath(`/team/${targetId}`)
  revalidatePath('/dashboard')
  revalidatePath('/admin')
  return { ok: true, message: messages.profileSaved }
}

/** @deprecated Prefer updateEmployeeProfile — kept for existing ProfileEditor imports. */
export async function updateOwnProfile(_prev: AdminResult | null, formData: FormData): Promise<AdminResult> {
  return updateEmployeeProfile(_prev, formData)
}
