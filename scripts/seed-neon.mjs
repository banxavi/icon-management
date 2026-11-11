/**
 * Seed Neon Auth users + app roster (same fake emails as scripts/seed-data.json).
 * Requires DATABASE_URL / DATABASE_URL_UNPOOLED and NEON_AUTH_BASE_URL.
 * Password hashes cannot transfer from Supabase — set SEED_PASSWORD in the shell
 * (not committed). Does not print connection strings or passwords.
 */
import fs from 'node:fs'
import pg from 'pg'

function loadEnvFile(path) {
  if (!fs.existsSync(path)) return
  for (const line of fs.readFileSync(path, 'utf8').split(/\r?\n/)) {
    if (!line || line.startsWith('#')) continue
    const i = line.indexOf('=')
    if (i < 0) continue
    const key = line.slice(0, i)
    let value = line.slice(i + 1)
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    if (!(key in process.env)) process.env[key] = value
  }
}

loadEnvFile('.env.local')
loadEnvFile('.env')

if (!process.env.DATABASE_URL && !process.env.DATABASE_URL_UNPOOLED) {
  console.error('Set DATABASE_URL (or DATABASE_URL_UNPOOLED) before seeding Neon.')
  process.exit(1)
}
if (!process.env.NEON_AUTH_BASE_URL) {
  console.error('Set NEON_AUTH_BASE_URL before seeding Neon Auth users.')
  process.exit(1)
}
const SEED_PASSWORD = process.env.SEED_PASSWORD
if (!SEED_PASSWORD || SEED_PASSWORD.length < 8) {
  console.error('Set SEED_PASSWORD (min 8 chars) in the shell before seeding.')
  process.exit(1)
}

const seed = JSON.parse(fs.readFileSync(new URL('./seed-data.json', import.meta.url), 'utf8'))
const TEAM_ID = '10000000-0000-4000-8000-000000000001'
const SETTINGS_ID = '40000000-0000-4000-8000-000000000001'
const ORG_TZ = 'Asia/Saigon'
const authBase = process.env.NEON_AUTH_BASE_URL.replace(/\/$/, '')

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL,
})

function orgYmd(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: ORG_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

function addCalendarDays(ymd, days) {
  const [y, m, d] = ymd.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d + days))
  return dt.toISOString().slice(0, 10)
}

function mondayOfWeek(ymd) {
  const [y, m, d] = ymd.split('-').map(Number)
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
  const diff = dow === 0 ? -6 : 1 - dow
  return addCalendarDays(ymd, diff)
}

async function ensureAuthUser(person) {
  const res = await fetch(`${authBase}/sign-up/email`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
    },
    body: JSON.stringify({
      email: person.email,
      password: SEED_PASSWORD,
      name: person.fullName,
    }),
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok || !body.user?.id) {
    throw new Error(`Auth sign-up failed for ${person.email}: ${body.message || body.code || res.status}`)
  }
  return String(body.user.id)
}

await client.connect()
await client.query('begin')
try {
  // Clear previous stub auth.users / profiles that used fixed UUIDs so FKs can remap.
  await client.query('delete from public.reviewer_assignments')
  await client.query('delete from public.project_members')
  await client.query('delete from public.user_roles')
  await client.query('delete from public.document_folder_grants')
  await client.query('delete from public.notifications')
  await client.query('delete from public.daily_reports')
  await client.query('delete from public.weekly_reports')
  await client.query('delete from public.audit_logs')
  await client.query('delete from public.login_attempts')
  await client.query('delete from public.document_versions')
  await client.query('delete from public.documents')
  await client.query('update public.teams set leader_id = null')
  await client.query('delete from public.profiles')
  await client.query('delete from auth.users')
  // Recreate Managed Auth users with a known SEED_PASSWORD (hashes do not transfer).
  const emails = seed.users.map((u) => u.email.toLowerCase())
  await client.query('delete from neon_auth.session where "userId" in (select id from neon_auth."user" where lower(email) = any($1::text[]))', [emails])
  await client.query('delete from neon_auth.account where "userId" in (select id from neon_auth."user" where lower(email) = any($1::text[]))', [emails])
  await client.query('delete from neon_auth."user" where lower(email) = any($1::text[])', [emails])

  const roles = await client.query('select id, code from public.roles')
  const roleIds = Object.fromEntries(roles.rows.map((r) => [r.code, r.id]))
  const projects = await client.query('select id, name from public.projects')
  const projectIds = Object.fromEntries(projects.rows.map((p) => [p.name, p.id]))

  const idByEmail = new Map()
  for (const person of seed.users) {
    const userId = await ensureAuthUser(person)
    idByEmail.set(person.email, userId)
    await client.query(
      `insert into auth.users (id, email, raw_user_meta_data)
       values ($1::uuid, $2::text, $3::jsonb)
       on conflict (id) do update set email = excluded.email, raw_user_meta_data = excluded.raw_user_meta_data`,
      [userId, person.email, JSON.stringify({ full_name: person.fullName })],
    )
    await client.query(
      `insert into public.profiles (id, full_name, email, status, team_id, contact, skills)
       values ($1::uuid, $2::text, $3::text, 'active', $4::uuid, $5::text, $6::text[])
       on conflict (id) do update set
         full_name = excluded.full_name,
         email = excluded.email,
         status = 'active',
         team_id = excluded.team_id,
         contact = excluded.contact,
         skills = excluded.skills,
         updated_at = now()`,
      [userId, person.fullName, person.email, TEAM_ID, person.contact, person.skills],
    )
    const roleId = roleIds[person.role]
    const projectId = projectIds[person.project]
    if (!roleId || !projectId) throw new Error(`Missing role/project for ${person.email}`)
    await client.query('insert into public.user_roles (user_id, role_id) values ($1::uuid,$2::uuid)', [userId, roleId])
    await client.query(
      'insert into public.project_members (user_id, project_id, member_role) values ($1::uuid,$2::uuid,$3::text)',
      [userId, projectId, person.role],
    )
  }


  const onTeam = await client.query('select count(*)::int as c from public.profiles where team_id = $1::uuid', [TEAM_ID])
  if (onTeam.rows[0].c !== seed.users.length) {
    throw new Error(`Expected ${seed.users.length} profiles on team after upsert, found ${onTeam.rows[0].c}.`)
  }

  const leaderId = idByEmail.get(seed.leaderEmail)
  await client.query('update public.teams set leader_id = $1::uuid where id = $2::uuid', [leaderId, TEAM_ID])

  const reviewerId = idByEmail.get(seed.reviewerEmail)
  for (const email of seed.reviewerAssignedEmails) {
    await client.query(
      'insert into public.reviewer_assignments (reviewer_id, member_id) values ($1::uuid,$2::uuid)',
      [reviewerId, idByEmail.get(email)],
    )
  }

  const folderGrants = [
    ['51000000-0000-4000-8000-000000000001', idByEmail.get('docs.owner@icon-dev.example'), 'manage'],
    ['51000000-0000-4000-8000-000000000002', idByEmail.get('docs.owner@icon-dev.example'), 'manage'],
    ['51000000-0000-4000-8000-000000000005', idByEmail.get('member05@icon-dev.example'), 'view'],
  ]
  for (const [folderId, userId, access] of folderGrants) {
    await client.query(
      `insert into public.document_folder_grants (folder_id, user_id, access)
       values ($1::uuid, $2::uuid, $3::text)
       on conflict do nothing`,
      [folderId, userId, access],
    )
  }

  await client.query(
    `insert into public.org_settings (id, timezone, retention_months, daily_window, max_upload_mb, allowed_extensions, weekly_deadline_weekday, weekly_deadline_time)
     values ($1::uuid, $2::text, 12, 'end_of_next_calendar_day', 50, $3::text[], 5, '17:00')
     on conflict (id) do update set
       timezone = excluded.timezone,
       weekly_deadline_weekday = excluded.weekly_deadline_weekday,
       weekly_deadline_time = excluded.weekly_deadline_time,
       updated_at = now()`,
    [SETTINGS_ID, ORG_TZ, ['pdf', 'docx', 'xlsx', 'pptx', 'md', 'png', 'jpg']],
  )

  const today = orgYmd()
  const weekStart = mondayOfWeek(today)
  // Sample daily for member05
  const member05 = idByEmail.get('member05@icon-dev.example')
  const coreProject = projectIds['ICON Core']
  await client.query(
    `insert into public.daily_reports (user_id, report_date, project_id, work_status, done_today, next_plan, status)
     values ($1::uuid, $2::date, $3::uuid, 'office', 'Seeded daily update', 'Continue portal work', 'submitted')
     on conflict (user_id, report_date) do nothing`,
    [member05, today, coreProject],
  )
  await client.query(
    `insert into public.weekly_reports (user_id, week_start, highlights, progress, risks, next_week_plan, status)
     values ($1::uuid, $2::date, 'Seed highlights', 'Seed progress', 'None', 'Next week plan', 'draft')
     on conflict (user_id, week_start) do nothing`,
    [member05, weekStart],
  )

  await client.query('commit')
  console.log(`Seeded ${seed.users.length} Neon Auth users + profiles. Password set via SEED_PASSWORD for newly created accounts.`)
} catch (error) {
  await client.query('rollback')
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
} finally {
  await client.end()
}
