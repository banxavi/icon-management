-- ICON Team 1 Portal — core schema, RLS, and reference data.
-- Apply on a fresh Supabase project (dev first). Down script:
-- supabase/rollback/20261024120000_init_core.down.sql
--
-- Daily report window: open through 23:59:59 Asia/Saigon on report_date + 1.
-- Writes after that instant are rejected. No approval flows. No admin override.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.roles (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code in ('member', 'team_leader', 'reviewer', 'admin', 'document_owner')),
  name text not null
);

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  leader_id uuid,
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  email text not null unique,
  status text not null default 'active' check (status in ('active', 'inactive')),
  team_id uuid references public.teams (id),
  contact text,
  skills text[] not null default '{}',
  last_activity_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.teams
  add constraint teams_leader_id_fkey
  foreign key (leader_id) references public.profiles (id);

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  role_id uuid not null references public.roles (id),
  unique (user_id, role_id)
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id),
  name text not null,
  description text,
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  unique (team_id, name)
);

create table public.project_members (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  member_role text,
  allocation_percent numeric,
  unique (project_id, user_id)
);

-- Reviewer sees only members listed here (AUTH-02).
create table public.reviewer_assignments (
  id uuid primary key default gen_random_uuid(),
  reviewer_id uuid not null references public.profiles (id) on delete cascade,
  member_id uuid not null references public.profiles (id) on delete cascade,
  unique (reviewer_id, member_id)
);

create table public.daily_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  report_date date not null,
  project_id uuid not null references public.projects (id),
  work_status text not null check (work_status in ('office', 'wfh')),
  wfh_reason text,
  done_today text not null default '',
  next_plan text not null default '',
  blockers text,
  status text not null default 'draft' check (status in ('draft', 'submitted')),
  submitted_at timestamptz,
  is_late boolean not null default false,
  edited_after_submit boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, report_date)
);

create table public.weekly_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  week_start date not null,
  highlights text,
  progress text,
  risks text,
  next_week_plan text,
  status text not null default 'draft' check (status in ('draft', 'submitted')),
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, week_start)
);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  folder text,
  tags text[] not null default '{}',
  owner_id uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.document_versions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents (id) on delete cascade,
  version_label text not null,
  storage_path text,
  uploaded_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  type text not null,
  title text not null,
  body text not null,
  read_at timestamptz,
  related_report_id uuid references public.daily_reports (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.org_settings (
  id uuid primary key default gen_random_uuid(),
  timezone text not null default 'Asia/Saigon',
  retention_months integer not null default 12 check (retention_months > 0),
  daily_window text not null default 'end_of_next_calendar_day',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles (id),
  action text not null,
  object_type text,
  object_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  ip text,
  created_at timestamptz not null default now()
);

-- Account lockout for AUTH-01 (5 failures, 15 minutes). Not readable by clients.
create table public.login_attempts (
  email text primary key,
  ip text,
  failed_count integer not null default 0,
  locked_until timestamptz,
  updated_at timestamptz not null default now()
);

create index daily_reports_report_date_idx on public.daily_reports (report_date);
create index notifications_recipient_idx on public.notifications (recipient_id, created_at desc);
create index audit_logs_created_idx on public.audit_logs (created_at desc);
create index user_roles_user_idx on public.user_roles (user_id);
create index project_members_user_idx on public.project_members (user_id);
create index reviewer_assignments_reviewer_idx on public.reviewer_assignments (reviewer_id);

-- ---------------------------------------------------------------------------
-- Helpers (security definer so RLS does not recurse)
-- ---------------------------------------------------------------------------

create or replace function public.has_role(p_role text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = auth.uid()
      and r.code = p_role
  );
$$;

create or replace function public.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and status = 'active'
  );
$$;

create or replace function public.can_submit()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_active_user()
    and (
      public.has_role('member')
      or public.has_role('team_leader')
      or public.has_role('document_owner')
    );
$$;

create or replace function public.same_team(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles me
    join public.profiles them on them.team_id = me.team_id
    where me.id = auth.uid()
      and them.id = p_user
      and me.team_id is not null
  );
$$;

create or replace function public.is_team_leader_of(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_role('team_leader') and public.same_team(p_user);
$$;

create or replace function public.is_assigned_reviewer_of(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_role('reviewer') and exists (
    select 1
    from public.reviewer_assignments
    where reviewer_id = auth.uid()
      and member_id = p_user
  );
$$;

-- Owner, team leader of that member, or assigned reviewer. Admin is not included
-- (technical-support reads go through get_daily_report and are audited).
create or replace function public.can_read_daily_report(p_owner uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_owner = auth.uid()
    or public.is_team_leader_of(p_owner)
    or public.is_assigned_reviewer_of(p_owner);
$$;

create or replace function public.org_timezone()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select case
      when timezone = 'Asia/Saigon' then 'Asia/Ho_Chi_Minh'
      else timezone
    end
    from public.org_settings
    limit 1),
    'Asia/Ho_Chi_Minh'
  );
$$;

-- Open while local time is strictly before 00:00:00 on report_date + 2 days.
create or replace function public.report_window_open(p_report_date date)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  local_now timestamp;
  window_end timestamp;
begin
  local_now := timezone(public.org_timezone(), now());
  window_end := (p_report_date + 2)::timestamp;
  return local_now < window_end;
end;
$$;

create or replace function public.enforce_daily_report_rules()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if not public.report_window_open(new.report_date) then
    raise exception 'REPORT_WINDOW_CLOSED'
      using errcode = '42501';
  end if;

  if tg_op = 'UPDATE' then
    new.user_id := old.user_id;
    if old.submitted_at is not null then
      new.submitted_at := old.submitted_at;
    end if;
  end if;

  if new.work_status = 'office' then
    new.wfh_reason := null;
  end if;

  if new.status = 'submitted' then
    if length(trim(coalesce(new.done_today, ''))) = 0
       or length(trim(coalesce(new.next_plan, ''))) = 0 then
      raise exception 'REQUIRED_FIELDS' using errcode = '23514';
    end if;
    if new.work_status = 'wfh' and length(trim(coalesce(new.wfh_reason, ''))) = 0 then
      raise exception 'WFH_REASON_REQUIRED' using errcode = '23514';
    end if;
    if new.project_id is null then
      raise exception 'REQUIRED_FIELDS' using errcode = '23514';
    end if;
    if new.submitted_at is null then
      new.submitted_at := now();
    end if;
  end if;

  if tg_op = 'UPDATE'
     and old.status = 'submitted'
     and (
       new.done_today is distinct from old.done_today
       or new.next_plan is distinct from old.next_plan
       or new.blockers is distinct from old.blockers
       or new.work_status is distinct from old.work_status
       or new.wfh_reason is distinct from old.wfh_reason
       or new.project_id is distinct from old.project_id
     ) then
    new.edited_after_submit := true;
  elsif tg_op = 'UPDATE' then
    new.edited_after_submit := old.edited_after_submit;
  end if;

  -- R1 rejects writes after the window, so a row cannot be marked late by submission.
  new.is_late := false;
  new.updated_at := now();
  return new;
end;
$$;

create trigger daily_reports_enforce
  before insert or update on public.daily_reports
  for each row execute function public.enforce_daily_report_rules();

create or replace function public.protect_profile_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Members may change contact, skills, and last_activity_at only.
  -- service_role and admins may change the rest. auth.role() is null for the DB owner.
  if auth.role() = 'authenticated' and not public.has_role('admin') then
    new.full_name := old.full_name;
    new.email := old.email;
    new.status := old.status;
    new.team_id := old.team_id;
    new.id := old.id;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_protect
  before update on public.profiles
  for each row execute function public.protect_profile_fields();

create or replace function public.protect_notification_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.recipient_id := old.recipient_id;
  new.type := old.type;
  new.title := old.title;
  new.body := old.body;
  new.related_report_id := old.related_report_id;
  new.created_at := old.created_at;
  return new;
end;
$$;

create trigger notifications_protect
  before update on public.notifications
  for each row execute function public.protect_notification_fields();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email, status)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'full_name', ''), split_part(new.email, '@', 1)),
    new.email,
    'active'
  )
  on conflict (id) do update
    set email = excluded.email;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.audit_access_denied(
  p_object_type text,
  p_object_id uuid,
  p_metadata jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return;
  end if;
  insert into public.audit_logs (actor_id, action, object_type, object_id, metadata)
  values (
    auth.uid(),
    'access_denied',
    p_object_type,
    p_object_id,
    coalesce(p_metadata, '{}'::jsonb)
  );
end;
$$;

create or replace function public.get_daily_report(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.daily_reports;
  allowed boolean;
begin
  if auth.uid() is null then
    return jsonb_build_object('status', 'unauthenticated');
  end if;

  select * into r from public.daily_reports where id = p_id;
  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;

  allowed := public.can_read_daily_report(r.user_id);
  if allowed then
    return jsonb_build_object('status', 'ok', 'report', to_jsonb(r));
  end if;

  if public.has_role('admin') then
    insert into public.audit_logs (actor_id, action, object_type, object_id, metadata)
    values (
      auth.uid(),
      'admin_report_access',
      'daily_report',
      p_id,
      jsonb_build_object('owner_id', r.user_id)
    );
    return jsonb_build_object('status', 'ok', 'report', to_jsonb(r));
  end if;

  insert into public.audit_logs (actor_id, action, object_type, object_id, metadata)
  values (
    auth.uid(),
    'access_denied',
    'daily_report',
    p_id,
    jsonb_build_object('owner_id', r.user_id)
  );
  return jsonb_build_object('status', 'forbidden');
end;
$$;

create or replace function public.notify_daily_report(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.daily_reports;
  author_name text;
  leader uuid;
  rec record;
  title text;
  body text;
  day text;
begin
  select * into r from public.daily_reports where id = p_id;
  if not found then
    raise exception 'NOT_FOUND';
  end if;
  if r.user_id is distinct from auth.uid() then
    raise exception 'FORBIDDEN';
  end if;
  if r.status is distinct from 'submitted' then
    return;
  end if;

  select full_name into author_name from public.profiles where id = r.user_id;
  day := to_char(r.report_date, 'YYYY-MM-DD');
  title := 'Daily report submitted';
  body := coalesce(author_name, 'A member') || ' submitted a daily report for ' || day || '.';

  select t.leader_id into leader
  from public.profiles p
  join public.teams t on t.id = p.team_id
  where p.id = r.user_id;

  if leader is not null and leader is distinct from r.user_id then
    insert into public.notifications (recipient_id, type, title, body, related_report_id)
    select leader, 'daily_report_submitted', title, body, r.id
    where not exists (
      select 1 from public.notifications n
      where n.recipient_id = leader
        and n.type = 'daily_report_submitted'
        and n.related_report_id = r.id
    );

    if r.work_status = 'wfh' then
      insert into public.notifications (recipient_id, type, title, body, related_report_id)
      select leader,
        'wfh_declared',
        'WFH declared',
        coalesce(author_name, 'A member') || ' declared WFH for ' || day || '. Reason: ' || coalesce(r.wfh_reason, ''),
        r.id
      where not exists (
        select 1 from public.notifications n
        where n.recipient_id = leader
          and n.type = 'wfh_declared'
          and n.related_report_id = r.id
      );
    end if;
  end if;

  for rec in
    select reviewer_id from public.reviewer_assignments where member_id = r.user_id
  loop
    if rec.reviewer_id is distinct from r.user_id then
      insert into public.notifications (recipient_id, type, title, body, related_report_id)
      select rec.reviewer_id, 'daily_report_submitted', title, body, r.id
      where not exists (
        select 1 from public.notifications n
        where n.recipient_id = rec.reviewer_id
          and n.type = 'daily_report_submitted'
          and n.related_report_id = r.id
      );
    end if;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.roles enable row level security;
alter table public.teams enable row level security;
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.reviewer_assignments enable row level security;
alter table public.daily_reports enable row level security;
alter table public.weekly_reports enable row level security;
alter table public.documents enable row level security;
alter table public.document_versions enable row level security;
alter table public.notifications enable row level security;
alter table public.org_settings enable row level security;
alter table public.audit_logs enable row level security;
alter table public.login_attempts enable row level security;

revoke all on public.login_attempts from anon, authenticated;

create policy roles_read on public.roles
  for select to authenticated using (true);

create policy teams_read on public.teams
  for select to authenticated using (
    public.has_role('admin')
    or exists (
      select 1 from public.profiles me
      where me.id = auth.uid() and me.team_id = teams.id
    )
  );

create policy teams_admin_write on public.teams
  for all to authenticated
  using (public.has_role('admin'))
  with check (public.has_role('admin'));

create policy profiles_read on public.profiles
  for select to authenticated using (
    id = auth.uid()
    or public.has_role('admin')
    or public.same_team(id)
  );

create policy profiles_update on public.profiles
  for update to authenticated
  using (id = auth.uid() or public.has_role('admin'))
  with check (id = auth.uid() or public.has_role('admin'));

create policy user_roles_read on public.user_roles
  for select to authenticated using (
    user_id = auth.uid()
    or public.has_role('admin')
    or public.same_team(user_id)
  );

create policy user_roles_admin_write on public.user_roles
  for all to authenticated
  using (public.has_role('admin'))
  with check (public.has_role('admin'));

create policy projects_read on public.projects
  for select to authenticated using (
    public.has_role('admin')
    or exists (
      select 1 from public.profiles me
      where me.id = auth.uid() and me.team_id = projects.team_id
    )
  );

create policy projects_admin_write on public.projects
  for all to authenticated
  using (public.has_role('admin'))
  with check (public.has_role('admin'));

create policy project_members_read on public.project_members
  for select to authenticated using (
    public.has_role('admin') or public.same_team(user_id)
  );

create policy project_members_admin_write on public.project_members
  for all to authenticated
  using (public.has_role('admin'))
  with check (public.has_role('admin'));

create policy reviewer_assignments_read on public.reviewer_assignments
  for select to authenticated using (
    public.has_role('admin')
    or reviewer_id = auth.uid()
    or public.is_team_leader_of(member_id)
  );

create policy reviewer_assignments_admin_write on public.reviewer_assignments
  for all to authenticated
  using (public.has_role('admin'))
  with check (public.has_role('admin'));

create policy daily_reports_read on public.daily_reports
  for select to authenticated using (public.can_read_daily_report(user_id));

create policy daily_reports_insert on public.daily_reports
  for insert to authenticated
  with check (user_id = auth.uid() and public.can_submit());

create policy daily_reports_update on public.daily_reports
  for update to authenticated
  using (user_id = auth.uid() and public.can_submit())
  with check (user_id = auth.uid() and public.can_submit());

create policy weekly_reports_read on public.weekly_reports
  for select to authenticated using (public.can_read_daily_report(user_id));

create policy weekly_reports_insert on public.weekly_reports
  for insert to authenticated
  with check (user_id = auth.uid() and public.can_submit());

create policy weekly_reports_update on public.weekly_reports
  for update to authenticated
  using (user_id = auth.uid() and public.can_submit())
  with check (user_id = auth.uid() and public.can_submit());

create policy documents_read on public.documents
  for select to authenticated using (public.is_active_user() or public.has_role('admin'));

create policy documents_write on public.documents
  for all to authenticated
  using (public.has_role('admin') or public.has_role('team_leader') or public.has_role('document_owner'))
  with check (public.has_role('admin') or public.has_role('team_leader') or public.has_role('document_owner'));

create policy document_versions_read on public.document_versions
  for select to authenticated using (public.is_active_user() or public.has_role('admin'));

create policy document_versions_write on public.document_versions
  for all to authenticated
  using (public.has_role('admin') or public.has_role('team_leader') or public.has_role('document_owner'))
  with check (public.has_role('admin') or public.has_role('team_leader') or public.has_role('document_owner'));

create policy notifications_read on public.notifications
  for select to authenticated using (recipient_id = auth.uid());

create policy notifications_update on public.notifications
  for update to authenticated
  using (recipient_id = auth.uid())
  with check (recipient_id = auth.uid());

create policy org_settings_read on public.org_settings
  for select to authenticated using (true);

create policy org_settings_admin_update on public.org_settings
  for update to authenticated
  using (public.has_role('admin'))
  with check (public.has_role('admin'));

create policy audit_logs_admin_read on public.audit_logs
  for select to authenticated using (public.has_role('admin'));

revoke all on function public.audit_access_denied(text, uuid, jsonb) from public, anon;
revoke all on function public.get_daily_report(uuid) from public, anon;
revoke all on function public.notify_daily_report(uuid) from public, anon;

grant execute on function public.audit_access_denied(text, uuid, jsonb) to authenticated;
grant execute on function public.get_daily_report(uuid) to authenticated;
grant execute on function public.notify_daily_report(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Reference data (no auth users — those come from scripts/seed-dev.mjs)
-- ---------------------------------------------------------------------------

insert into public.roles (code, name) values
  ('member', 'Member'),
  ('team_leader', 'Team Leader'),
  ('reviewer', 'Reviewer'),
  ('admin', 'Admin'),
  ('document_owner', 'Document Owner');

insert into public.teams (id, name) values
  ('10000000-0000-4000-8000-000000000001', 'ICON Team 1');

insert into public.projects (id, team_id, name, status) values
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'ICON Core', 'active'),
  ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 'Support Platform', 'active'),
  ('20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001', 'Internal Tools', 'active');

insert into public.org_settings (id, timezone, retention_months, daily_window) values
  ('40000000-0000-4000-8000-000000000001', 'Asia/Saigon', 12, 'end_of_next_calendar_day');
