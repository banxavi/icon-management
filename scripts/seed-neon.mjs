/**
 * Seed Neon with the same fake roster as scripts/seed-data.json, via direct Postgres.
 * Requires DATABASE_URL or DATABASE_URL_UNPOOLED. Does not print connection strings.
 */
import fs from 'node:fs'
import pg from 'pg'

if (!process.env.DATABASE_URL && !process.env.DATABASE_URL_UNPOOLED) {
  console.error('Set DATABASE_URL (or DATABASE_URL_UNPOOLED) before seeding Neon.')
  process.exit(1)
}

const seed = JSON.parse(fs.readFileSync(new URL('./seed-data.json', import.meta.url), 'utf8'))
const TEAM_ID = '10000000-0000-4000-8000-000000000001'
const SETTINGS_ID = '40000000-0000-4000-8000-000000000001'
const ORG_TZ = 'Asia/Saigon'

const client = new pg.Client({
  // Neon URLs include sslmode; never disable certificate verification here.
  connectionString: process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL,
})

/** Calendar YYYY-MM-DD in org timezone (Asia/Saigon). */
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
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay() // 0 = Sunday
  const diff = dow === 0 ? -6 : 1 - dow
  return addCalendarDays(ymd, diff)
}

await client.connect()
await client.query('begin')
try {
  const roles = await client.query('select id, code from public.roles')
  const roleIds = Object.fromEntries(roles.rows.map((r) => [r.code, r.id]))
  const projects = await client.query('select id, name from public.projects')
  const projectIds = Object.fromEntries(projects.rows.map((p) => [p.name, p.id]))

  const idByEmail = new Map()
  for (const person of seed.users) {
    await client.query(
      `insert into auth.users (id, email, raw_user_meta_data)
       values ($1::uuid, $2::text, $3::jsonb)
       on conflict (id) do update set email = excluded.email, raw_user_meta_data = excluded.raw_user_meta_data`,
      [person.id, person.email, JSON.stringify({ full_name: person.fullName })],
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
      [person.id, person.fullName, person.email, TEAM_ID, person.contact, person.skills],
    )
    const roleId = roleIds[person.role]
    const projectId = projectIds[person.project]
    if (!roleId || !projectId) throw new Error(`Missing role/project for ${person.email}`)
    await client.query('delete from public.user_roles where user_id = $1::uuid', [person.id])
    await client.query('insert into public.user_roles (user_id, role_id) values ($1::uuid,$2::uuid)', [
      person.id,
      roleId,
    ])
    await client.query('delete from public.project_members where user_id = $1::uuid', [person.id])
    await client.query(
      'insert into public.project_members (user_id, project_id, member_role) values ($1::uuid,$2::uuid,$3::text)',
      [person.id, projectId, person.role],
    )
    idByEmail.set(person.email, person.id)
  }

  const onTeam = await client.query(
    'select count(*)::int as c from public.profiles where team_id = $1::uuid',
    [TEAM_ID],
  )
  if (onTeam.rows[0].c !== seed.users.length) {
    throw new Error(
      `Expected ${seed.users.length} profiles on team after upsert, found ${onTeam.rows[0].c}. Check auth.role() stub.`,
    )
  }

  const leaderId = idByEmail.get(seed.leaderEmail)
  await client.query('update public.teams set leader_id = $1::uuid where id = $2::uuid', [leaderId, TEAM_ID])

  const reviewerId = idByEmail.get(seed.reviewerEmail)
  await client.query('delete from public.reviewer_assignments where reviewer_id = $1::uuid', [reviewerId])
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
       values ($1::uuid,$2::uuid,$3::text) on conflict do nothing`,
      [folderId, userId, access],
    )
  }

  await client.query(
    `update public.org_settings
     set weekly_deadline_weekday = 5, weekly_deadline_time = '17:00', updated_at = now()
     where id = $1::uuid`,
    [SETTINGS_ID],
  )

  const member05 = idByEmail.get('member05@icon-dev.example')
  const member06 = idByEmail.get('member06@icon-dev.example')
  const docsOwner = idByEmail.get('docs.owner@icon-dev.example')
  const projectCore = projectIds['ICON Core']
  const projectSupport = projectIds['Support Platform']

  const today = orgYmd()
  const yday = addCalendarDays(today, -1)
  const weekStart = mondayOfWeek(today)

  const dailyToday = await client.query(
    `insert into public.daily_reports (
       user_id, report_date, project_id, work_status, wfh_reason, done_today, next_plan, blockers, status, submitted_at
     ) values (
       $1::uuid, $2::date, $3::uuid, 'office', null,
       'Implemented Neon schema apply path.', 'Seed verification queries.', null, 'submitted', now()
     )
     on conflict (user_id, report_date) do update set
       project_id = excluded.project_id,
       work_status = excluded.work_status,
       wfh_reason = excluded.wfh_reason,
       done_today = excluded.done_today,
       next_plan = excluded.next_plan,
       blockers = excluded.blockers,
       status = 'submitted',
       submitted_at = coalesce(public.daily_reports.submitted_at, now()),
       updated_at = now()
     returning id`,
    [member05, today, projectCore],
  )

  await client.query(
    `insert into public.daily_reports (
       user_id, report_date, project_id, work_status, wfh_reason, done_today, next_plan, blockers, status, submitted_at
     ) values (
       $1::uuid, $2::date, $3::uuid, 'wfh', 'Home office scheduled',
       'Wrote QA notes for portal.', 'Review team board.', 'Waiting on design review', 'submitted', now()
     )
     on conflict (user_id, report_date) do update set
       project_id = excluded.project_id,
       work_status = excluded.work_status,
       wfh_reason = excluded.wfh_reason,
       done_today = excluded.done_today,
       next_plan = excluded.next_plan,
       blockers = excluded.blockers,
       status = 'submitted',
       submitted_at = coalesce(public.daily_reports.submitted_at, now()),
       updated_at = now()`,
    [member06, yday, projectSupport],
  )

  await client.query(
    `insert into public.weekly_reports (
       user_id, week_start, highlights, progress, risks, next_week_plan, status, submitted_at
     ) values (
       $1::uuid, $2::date,
       'Shipped schema bootstrap for Neon.',
       'Migrations applied; seed in progress.',
       'Auth is stubbed without Supabase Auth APIs.',
       'Wire app connection to Neon when ready.',
       'submitted', now()
     )
     on conflict (user_id, week_start) do update set
       highlights = excluded.highlights,
       progress = excluded.progress,
       risks = excluded.risks,
       next_week_plan = excluded.next_week_plan,
       status = 'submitted',
       submitted_at = coalesce(public.weekly_reports.submitted_at, now()),
       updated_at = now()`,
    [member05, weekStart],
  )

  const docId = '70000000-0000-4000-8000-000000000001'
  const verId = '71000000-0000-4000-8000-000000000001'
  await client.query(
    `insert into public.documents (id, name, folder, folder_id, tags, owner_id)
     values ($1::uuid, 'Team Handbook', 'Policies', '51000000-0000-4000-8000-000000000001'::uuid,
             array['policy','onboarding']::text[], $2::uuid)
     on conflict (id) do update set name = excluded.name, updated_at = now()`,
    [docId, docsOwner],
  )
  await client.query(
    `insert into public.document_versions (
       id, document_id, version_label, version_number, storage_path, uploaded_by,
       file_name, mime_type, byte_size, ready
     ) values (
       $1::uuid, $2::uuid, 'v1', 1,
       '51000000-0000-4000-8000-000000000001/' || $2::text || '/' || $1::text || '/team-handbook.md',
       $3::uuid, 'team-handbook.md', 'text/markdown', 2048, true
     )
     on conflict (id) do nothing`,
    [verId, docId, docsOwner],
  )
  await client.query('update public.documents set current_version_id = $1::uuid where id = $2::uuid', [verId, docId])

  const reportId = dailyToday.rows[0].id
  await client.query(
    `insert into public.notifications (recipient_id, type, title, body, related_report_id)
     select $1::uuid, 'daily_report_submitted', 'Daily report submitted',
            'Do Duc Long submitted a daily report for ' || $2::text || '.',
            $3::uuid
     where not exists (
       select 1 from public.notifications n
       where n.recipient_id = $1::uuid
         and n.related_report_id = $3::uuid
         and n.type = 'daily_report_submitted'
     )`,
    [leaderId, today, reportId],
  )

  await client.query(
    `insert into public.audit_logs (actor_id, action, object_type, object_id, metadata)
     values ($1::uuid, 'neon_seed_complete', 'org', $2::uuid, '{"source":"seed-neon.mjs"}'::jsonb)`,
    [idByEmail.get('admin@icon-dev.example'), TEAM_ID],
  )

  await client.query('commit')
  console.log(
    `Seeded ${seed.users.length} users on team; sample reports for ${today} / ${yday} (${ORG_TZ}); week_start ${weekStart}.`,
  )
} catch (err) {
  await client.query('rollback')
  console.error('Seed failed:', err.message)
  if (err.position) console.error('position', err.position)
  if (err.detail) console.error('detail', err.detail)
  if (err.where) console.error('where', err.where)
  process.exitCode = 1
}
await client.end()
