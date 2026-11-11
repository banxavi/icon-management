'use server'

import { revalidatePath } from 'next/cache'
import { parseMemberCsv } from '@/lib/admin/csv'
import { parseOrgSettings } from '@/lib/admin/settings'
import { canEditProfileField } from '@/lib/auth/profile'
import { clientIp } from '@/lib/auth/request'
import { requireSession } from '@/lib/auth/session'
import { auth, authReady } from '@/lib/auth/server'
import { TEAM_ID } from '@/lib/constants'
import { getSql } from '@/lib/db'
import { siteUrl } from '@/lib/env'
import { messages } from '@/lib/messages'
import type { AppRole } from '@/lib/types'

export type AdminResult = { ok: true; message: string } | { ok: false; errors: string[] }

async function requireAdmin() {
  const session = await requireSession()
  if (!session.roles.includes('admin')) {
    const sql = getSql()
    if (sql) {
      try {
        await sql`select public.audit_access_denied('page', null, ${JSON.stringify({ path: '/admin' })}::jsonb)`
      } catch {
        // ignore
      }
    }
    return null
  }
  return session
}

async function findUserIdByEmail(email: string): Promise<{ id: string | null; error?: string }> {
  const sql = getSql()
  if (!sql) return { id: null, error: 'Database is not configured.' }
  const rows = await sql`select id from neon_auth."user" where lower(email) = ${email.toLowerCase()} limit 1`
  if (rows[0]?.id) return { id: String(rows[0].id) }
  const profile = await sql`select id from public.profiles where lower(email) = ${email.toLowerCase()} limit 1`
  return { id: profile[0]?.id ? String(profile[0].id) : null }
}

async function applyMembership(userId: string, role: AppRole, projectName: string, assignedMemberIds?: string[]) {
  const sql = getSql()
  if (!sql) return 'Database is not configured.'
  const roleRows = await sql`select id from public.roles where code = ${role} limit 1`
  if (!roleRows[0]) return `Could not find the ${role} role.`
  const projectRows = await sql`select id from public.projects where name = ${projectName} limit 1`
  if (!projectRows[0]) return `Project "${projectName}" was not found.`

  await sql`update public.profiles set team_id = ${TEAM_ID}::uuid where id = ${userId}::uuid`
  await sql`delete from public.user_roles where user_id = ${userId}::uuid`
  await sql`insert into public.user_roles (user_id, role_id) values (${userId}::uuid, ${roleRows[0].id}::uuid)`
  await sql`delete from public.project_members where user_id = ${userId}::uuid`
  await sql`
    insert into public.project_members (user_id, project_id, member_role)
    values (${userId}::uuid, ${projectRows[0].id}::uuid, ${role})
  `

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
      // Invite-style: request password reset so the member sets their own password.
      await auth.requestPasswordReset({
        email: row.email,
        redirectTo: `${siteUrl()}/login/update-password`,
      }).catch(() => null)
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

export async function updateOwnProfile(_prev: AdminResult | null, formData: FormData): Promise<AdminResult> {
  const session = await requireSession()
  const sql = getSql()
  if (!sql) return { ok: false, errors: [messages.saveFailed] }
  const contact = String(formData.get('contact') || '').trim()
  const skills = String(formData.get('skills') || '')
    .split(',')
    .map((skill) => skill.trim())
    .filter(Boolean)
  try {
    await sql`
      update public.profiles set contact = ${contact}, skills = ${skills}
      where id = ${session.id}::uuid
    `
  } catch (error) {
    return { ok: false, errors: [error instanceof Error ? error.message : messages.saveFailed] }
  }
  revalidatePath('/team/directory')
  revalidatePath(`/team/${session.id}`)
  return { ok: true, message: messages.profileSaved }
}
