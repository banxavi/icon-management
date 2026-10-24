'use server'

import { revalidatePath } from 'next/cache'
import { parseMemberCsv } from '@/lib/admin/csv'
import { parseOrgSettings } from '@/lib/admin/settings'
import { canEditProfileField } from '@/lib/auth/profile'
import { clientIp } from '@/lib/auth/request'
import { requireSession } from '@/lib/auth/session'
import { TEAM_ID } from '@/lib/constants'
import { messages } from '@/lib/messages'
import { createAdminClient } from '@/lib/supabase/admin'
import { siteUrl } from '@/lib/supabase/env'
import { createClient } from '@/lib/supabase/server'
import type { AppRole } from '@/lib/types'

export type AdminResult = { ok: true; message: string } | { ok: false; errors: string[] }

async function requireAdmin() {
  const session = await requireSession()
  if (!session.roles.includes('admin')) {
    const supabase = await createClient()
    await supabase?.rpc('audit_access_denied', {
      p_object_type: 'page',
      p_object_id: null,
      p_metadata: { path: '/admin' },
    })
    return null
  }
  return session
}

async function findUserId(admin: NonNullable<ReturnType<typeof createAdminClient>>, email: string) {
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    if (error) return { error: error.message }
    const found = data.users.find((user) => user.email?.toLowerCase() === email)
    if (found) return { id: found.id }
    if (data.users.length < 200) return { id: null }
  }
  return { id: null }
}

async function applyMembership(admin: NonNullable<ReturnType<typeof createAdminClient>>, userId: string, role: AppRole, projectName: string, assignedMemberIds?: string[]) {
  const { data: roleRow, error: roleError } = await admin.from('roles').select('id').eq('code', role).single()
  if (roleError || !roleRow) return `Could not find the ${role} role.`
  const { data: project, error: projectError } = await admin.from('projects').select('id').eq('name', projectName).maybeSingle()
  if (projectError || !project) return `Project "${projectName}" was not found.`

  await admin.from('profiles').update({ team_id: TEAM_ID, status: 'active' }).eq('id', userId)
  await admin.from('user_roles').delete().eq('user_id', userId)
  const { error: roleInsertError } = await admin.from('user_roles').insert({ user_id: userId, role_id: roleRow.id })
  if (roleInsertError) return roleInsertError.message

  await admin.from('project_members').delete().eq('user_id', userId)
  const { error: memberError } = await admin.from('project_members').insert({ user_id: userId, project_id: project.id, member_role: role })
  if (memberError) return memberError.message

  if (role === 'team_leader') {
    await admin.from('teams').update({ leader_id: userId }).eq('id', TEAM_ID)
  }
  if (role !== 'reviewer') {
    await admin.from('reviewer_assignments').delete().eq('reviewer_id', userId)
  } else if (assignedMemberIds) {
    await admin.from('reviewer_assignments').delete().eq('reviewer_id', userId)
    if (assignedMemberIds.length > 0) {
      const { error } = await admin.from('reviewer_assignments').insert(
        assignedMemberIds.filter((id) => id !== userId).map((memberId) => ({ reviewer_id: userId, member_id: memberId })),
      )
      if (error) return error.message
    }
  }
  return null
}

export async function importMembers(_prev: AdminResult | null, formData: FormData): Promise<AdminResult> {
  const session = await requireAdmin()
  if (!session) return { ok: false, errors: [messages.forbidden] }
  const admin = createAdminClient()
  if (!admin) return { ok: false, errors: [messages.importNeedsServer] }

  const file = formData.get('file')
  const text = file instanceof File ? await file.text() : String(formData.get('csv') || '')
  const { data: projects } = await admin.from('projects').select('name')
  const parsed = parseMemberCsv(text, (projects ?? []).map((project) => String(project.name)))
  if (!parsed.ok) return { ok: false, errors: parsed.errors }

  const errors: string[] = []
  for (const row of parsed.rows) {
    const located = await findUserId(admin, row.email)
    if ('error' in located && located.error) {
      errors.push(`Row ${row.line}: ${located.error}`)
      continue
    }
    let userId = located.id
    if (!userId) {
      const { data, error } = await admin.auth.admin.inviteUserByEmail(row.email, {
        data: { full_name: row.fullName },
        redirectTo: `${siteUrl()}/auth/callback?next=/login/update-password`,
      })
      if (error || !data.user) {
        errors.push(`Row ${row.line}: ${error?.message ?? 'Could not create the account.'}`)
        continue
      }
      userId = data.user.id
    }
    const { error: profileError } = await admin.from('profiles').update({
      full_name: row.fullName,
      email: row.email,
      team_id: TEAM_ID,
    }).eq('id', userId)
    if (profileError) {
      errors.push(`Row ${row.line}: ${profileError.message}`)
      continue
    }
    const membershipError = await applyMembership(admin, userId, row.role, row.project)
    if (membershipError) errors.push(`Row ${row.line}: ${membershipError}`)
  }

  await admin.from('audit_logs').insert({
    actor_id: session.id,
    action: 'users_imported',
    object_type: 'profile',
    metadata: { rows: parsed.rows.length, ip: await clientIp() },
  })
  revalidatePath('/admin')
  revalidatePath('/team/directory')
  if (errors.length > 0) return { ok: false, errors }
  return { ok: true, message: `Imported ${parsed.rows.length} users. Reviewer assignments can be set on each reviewer.` }
}

export async function updateAccount(formData: FormData): Promise<AdminResult> {
  const session = await requireAdmin()
  if (!session) return { ok: false, errors: [messages.forbidden] }
  const admin = createAdminClient()
  if (!admin) return { ok: false, errors: [messages.importNeedsServer] }

  const userId = String(formData.get('userId') || '')
  const role = String(formData.get('role') || '') as AppRole
  const project = String(formData.get('project') || '')
  const assigned = formData.getAll('assigned').map(String)
  const membershipError = await applyMembership(admin, userId, role, project, assigned)
  if (membershipError) return { ok: false, errors: [membershipError] }
  await admin.from('audit_logs').insert({
    actor_id: session.id,
    action: 'role_assigned',
    object_type: 'profile',
    object_id: userId,
    metadata: { role, project, assigned },
  })
  revalidatePath('/admin')
  return { ok: true, message: messages.roleSaved }
}

export async function setAccountActive(formData: FormData): Promise<AdminResult> {
  const session = await requireAdmin()
  if (!session) return { ok: false, errors: [messages.forbidden] }
  const admin = createAdminClient()
  if (!admin) return { ok: false, errors: [messages.importNeedsServer] }
  const userId = String(formData.get('userId') || '')
  const active = String(formData.get('active') || '') === 'true'
  const { error } = await admin.auth.admin.updateUserById(userId, { ban_duration: active ? 'none' : '876000h' })
  if (error) return { ok: false, errors: [error.message] }
  const { error: profileError } = await admin.from('profiles').update({ status: active ? 'active' : 'inactive' }).eq('id', userId)
  if (profileError) return { ok: false, errors: [profileError.message] }
  await admin.from('audit_logs').insert({
    actor_id: session.id,
    action: active ? 'user_reactivated' : 'user_deactivated',
    object_type: 'profile',
    object_id: userId,
    metadata: {},
  })
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
  })
  if (!parsed.ok) return parsed
  const supabase = await createClient()
  if (!supabase) return { ok: false, errors: [messages.saveFailed] }
  const { data: current } = await supabase.from('org_settings').select('id').limit(1).maybeSingle()
  if (!current) return { ok: false, errors: [messages.saveFailed] }
  const { error } = await supabase.from('org_settings').update({
    timezone: parsed.value.timezone,
    retention_months: parsed.value.retentionMonths,
    daily_window: parsed.value.dailyWindow,
    max_upload_mb: parsed.value.maxUploadMb,
    allowed_extensions: parsed.value.allowedExtensions,
    updated_at: new Date().toISOString(),
  }).eq('id', current.id)
  if (error) return { ok: false, errors: [error.message] }
  const admin = createAdminClient()
  if (admin) {
    await admin.from('audit_logs').insert({
      actor_id: session.id,
      action: 'org_settings_updated',
      object_type: 'org_settings',
      object_id: current.id,
      metadata: parsed.value,
    })
  }
  revalidatePath('/admin')
  revalidatePath('/documents')
  return { ok: true, message: messages.settingsSaved }
}

export async function updateMemberName(_prev: AdminResult | null, formData: FormData): Promise<AdminResult> {
  const session = await requireSession()
  const userId = String(formData.get('userId') || '')
  const fullName = String(formData.get('fullName') || '').trim()
  if (fullName.length < 2 || fullName.length > 120) {
    return { ok: false, errors: ['Enter a name between 2 and 120 characters.'] }
  }
  const supabase = await createClient()
  if (!supabase) return { ok: false, errors: [messages.saveFailed] }
  const { data: target } = await supabase.from('profiles').select('id, team_id').eq('id', userId).maybeSingle()
  if (!target) return { ok: false, errors: [messages.forbidden] }
  const allowed = canEditProfileField({
    actorId: session.id,
    actorRoles: session.roles,
    targetId: userId,
    field: 'fullName',
    sameTeam: Boolean(session.teamId && target.team_id === session.teamId),
  })
  if (!allowed) return { ok: false, errors: ['Only an Admin or Team Leader can change another member name.'] }
  const { data, error } = await supabase.from('profiles').update({ full_name: fullName }).eq('id', userId).select('full_name').maybeSingle()
  if (error || !data) return { ok: false, errors: [error?.message || messages.saveFailed] }
  if (data.full_name !== fullName) return { ok: false, errors: ['That name could not be changed.'] }
  revalidatePath('/team/directory')
  revalidatePath(`/team/${userId}`)
  return { ok: true, message: messages.nameSaved }
}

export async function updateOwnProfile(_prev: AdminResult | null, formData: FormData): Promise<AdminResult> {
  const session = await requireSession()
  const supabase = await createClient()
  if (!supabase) return { ok: false, errors: [messages.saveFailed] }
  const contact = String(formData.get('contact') || '').trim()
  const skills = String(formData.get('skills') || '')
    .split(',')
    .map((skill) => skill.trim())
    .filter(Boolean)
  const { error } = await supabase.from('profiles').update({ contact, skills }).eq('id', session.id)
  if (error) return { ok: false, errors: [error.message] }
  revalidatePath('/team/directory')
  revalidatePath(`/team/${session.id}`)
  return { ok: true, message: messages.profileSaved }
}
