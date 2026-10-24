-- Rollback for 20261024233000_weekly_reports_deadline.sql
-- Drops the weekly deadline columns and the submit trigger.
-- Does not drop weekly_reports or its RLS policies from the core migration.

drop trigger if exists weekly_reports_enforce on public.weekly_reports;
drop function if exists public.enforce_weekly_report_rules();

alter table public.org_settings drop column if exists weekly_deadline_time;
alter table public.org_settings drop column if exists weekly_deadline_weekday;
