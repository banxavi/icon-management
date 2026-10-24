-- REP-04: weekly reports are real. The table and RLS were created in
-- 20261024120000_init_core.sql. This migration adds the Friday 17:00 deadline
-- on org_settings (ADM-01) and rejects an empty submitted weekly report.
-- Member writes their own row. Team Leader and assigned Reviewer read.
-- No approval and no admin override.
-- Down script: supabase/rollback/20261024233000_weekly_reports_deadline.down.sql

alter table public.org_settings
  add column if not exists weekly_deadline_weekday smallint not null default 5 check (weekly_deadline_weekday between 0 and 6),
  add column if not exists weekly_deadline_time text not null default '17:00' check (weekly_deadline_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');

-- 0 = Sunday … 5 = Friday, matching the app weekday index. Time is local to org_settings.timezone.

create or replace function public.enforce_weekly_report_rules()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' then
    new.user_id := old.user_id;
    new.week_start := old.week_start;
    if old.submitted_at is not null then
      new.submitted_at := old.submitted_at;
    end if;
  end if;

  if new.status = 'submitted' then
    if length(trim(coalesce(new.highlights, ''))) = 0
       or length(trim(coalesce(new.progress, ''))) = 0
       or length(trim(coalesce(new.risks, ''))) = 0
       or length(trim(coalesce(new.next_week_plan, ''))) = 0 then
      raise exception 'WEEKLY_REQUIRED' using errcode = '23514';
    end if;
    if new.submitted_at is null then
      new.submitted_at := now();
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists weekly_reports_enforce on public.weekly_reports;
create trigger weekly_reports_enforce
  before insert or update on public.weekly_reports
  for each row execute function public.enforce_weekly_report_rules();

drop policy if exists weekly_reports_read on public.weekly_reports;
drop policy if exists weekly_reports_insert on public.weekly_reports;
drop policy if exists weekly_reports_update on public.weekly_reports;

create policy weekly_reports_read on public.weekly_reports
  for select to authenticated using (public.can_read_daily_report(user_id));

create policy weekly_reports_insert on public.weekly_reports
  for insert to authenticated
  with check (user_id = auth.uid() and public.can_submit());

create policy weekly_reports_update on public.weekly_reports
  for update to authenticated
  using (user_id = auth.uid() and public.can_submit())
  with check (user_id = auth.uid() and public.can_submit());
