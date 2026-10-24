/**
 * Seed the Supabase dev project with 17 fake members, 1 team, and 3 projects.
 *
 * Required in the shell (never commit them):
 *   NEXT_PUBLIC_SUPABASE_URL=https://egylwfpxaxqqlmselygj.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY=...
 *   SEED_DEV_PASSWORD=...
 *
 * Usage: pnpm seed:dev
 * The migration must already be applied. This script does not print secrets.
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const password = process.env.SEED_DEV_PASSWORD

if (!url || !serviceKey || !password) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or SEED_DEV_PASSWORD.')
  process.exit(1)
}
if (password.length < 8) {
  console.error('SEED_DEV_PASSWORD must be at least 8 characters.')
  process.exit(1)
}

const TEAM_ID = '10000000-0000-4000-8000-000000000001'
const seed = JSON.parse(readFileSync(new URL('./seed-data.json', import.meta.url), 'utf8'))
const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })

async function findUser(email) {
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw new Error(error.message)
    const found = data.users.find((user) => user.email?.toLowerCase() === email)
    if (found) return found
    if (data.users.length < 200) return null
  }
  return null
}

async function ensureUser(person) {
  const existing = await findUser(person.email)
  if (existing) {
    const { error } = await admin.auth.admin.updateUserById(existing.id, {
      password,
      email_confirm: true,
      user_metadata: { full_name: person.fullName },
      ban_duration: 'none',
    })
    if (error) throw new Error(`${person.email}: ${error.message}`)
    return existing.id
  }
  const { data, error } = await admin.auth.admin.createUser({
    id: person.id,
    email: person.email,
    password,
    email_confirm: true,
    user_metadata: { full_name: person.fullName },
  })
  if (error || !data.user) throw new Error(`${person.email}: ${error?.message ?? 'create failed'}`)
  return data.user.id
}

const roleIds = new Map()
{
  const { data, error } = await admin.from('roles').select('id, code')
  if (error) throw new Error(error.message)
  for (const role of data ?? []) roleIds.set(role.code, role.id)
}

const projectIds = new Map()
{
  const { data, error } = await admin.from('projects').select('id, name')
  if (error) throw new Error(error.message)
  for (const project of data ?? []) projectIds.set(project.name, project.id)
}

const idByEmail = new Map()
for (const person of seed.users) {
  const userId = await ensureUser(person)
  idByEmail.set(person.email, userId)
  const { error } = await admin.from('profiles').upsert({
    id: userId,
    full_name: person.fullName,
    email: person.email,
    status: 'active',
    team_id: TEAM_ID,
    contact: person.contact,
    skills: person.skills,
  })
  if (error) throw new Error(`${person.email} profile: ${error.message}`)

  const roleId = roleIds.get(person.role)
  const projectId = projectIds.get(person.project)
  if (!roleId || !projectId) throw new Error(`${person.email}: missing role or project. Apply the migration first.`)

  await admin.from('user_roles').delete().eq('user_id', userId)
  const { error: roleError } = await admin.from('user_roles').insert({ user_id: userId, role_id: roleId })
  if (roleError) throw new Error(roleError.message)

  await admin.from('project_members').delete().eq('user_id', userId)
  const { error: memberError } = await admin.from('project_members').insert({
    user_id: userId,
    project_id: projectId,
    member_role: person.role,
  })
  if (memberError) throw new Error(memberError.message)
  console.log(`seeded ${person.email} (${person.role})`)
}

const leaderId = idByEmail.get(seed.leaderEmail)
if (!leaderId) throw new Error('Leader email missing from seed.')
const { error: leaderError } = await admin.from('teams').update({ leader_id: leaderId }).eq('id', TEAM_ID)
if (leaderError) throw new Error(leaderError.message)

const reviewerId = idByEmail.get(seed.reviewerEmail)
await admin.from('reviewer_assignments').delete().eq('reviewer_id', reviewerId)
const assignments = seed.reviewerAssignedEmails.map((email) => ({
  reviewer_id: reviewerId,
  member_id: idByEmail.get(email),
}))
const { error: assignError } = await admin.from('reviewer_assignments').insert(assignments)
if (assignError) throw new Error(assignError.message)

const { count, error: countError } = await admin.from('profiles').select('id', { count: 'exact', head: true }).eq('team_id', TEAM_ID)
if (countError) throw new Error(countError.message)
if (count !== 17) {
  console.error(`Expected 17 profiles on the team, found ${count}.`)
  process.exit(1)
}

const folderGrants = [
  { folder_id: '51000000-0000-4000-8000-000000000001', user_id: idByEmail.get('docs.owner@icon-dev.example'), access: 'manage' },
  { folder_id: '51000000-0000-4000-8000-000000000002', user_id: idByEmail.get('docs.owner@icon-dev.example'), access: 'manage' },
  { folder_id: '51000000-0000-4000-8000-000000000005', user_id: idByEmail.get('member05@icon-dev.example'), access: 'view' },
]
const { error: grantError } = await admin.from('document_folder_grants').upsert(folderGrants, { onConflict: 'folder_id,user_id,access' })
if (grantError) {
  throw new Error(`Folder grants: ${grantError.message}. Apply supabase/migrations/20261024203000_documents_and_settings.sql first.`)
}

const SETTINGS_ID = '40000000-0000-4000-8000-000000000001'
const { data: weeklySettings, error: weeklySettingsError } = await admin
  .from('org_settings')
  .update({ weekly_deadline_weekday: 5, weekly_deadline_time: '17:00' })
  .eq('id', SETTINGS_ID)
  .select('id')
if (weeklySettingsError) {
  throw new Error(`Weekly deadline: ${weeklySettingsError.message}. Apply supabase/migrations/20261024233000_weekly_reports_deadline.sql first.`)
}
if (!weeklySettings?.length) {
  throw new Error('org_settings row is missing. Apply the migrations before seeding.')
}

console.log('Dev seed complete: 17 members, 1 team, 3 projects, document folder grants, weekly deadline Friday 17:00.')
