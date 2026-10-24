-- Rollback for 20261024120000_init_core.sql
-- Drops app tables and the auth.users trigger. Does not delete auth.users.
-- Run manually. Take a backup first. Do not run against production without approval.

drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();
drop function if exists public.notify_daily_report(uuid);
drop function if exists public.get_daily_report(uuid);
drop function if exists public.audit_access_denied(text, uuid, jsonb);
drop function if exists public.report_window_open(date);
drop function if exists public.org_timezone();
drop function if exists public.can_read_daily_report(uuid);
drop function if exists public.is_assigned_reviewer_of(uuid);
drop function if exists public.is_team_leader_of(uuid);
drop function if exists public.same_team(uuid);
drop function if exists public.can_submit();
drop function if exists public.is_active_user();
drop function if exists public.has_role(text);

drop table if exists public.login_attempts;
drop table if exists public.audit_logs;
drop table if exists public.notifications;
drop table if exists public.document_versions;
drop table if exists public.documents;
drop table if exists public.weekly_reports;
drop table if exists public.daily_reports;
drop table if exists public.reviewer_assignments;
drop table if exists public.project_members;
drop table if exists public.projects;
drop table if exists public.user_roles;
alter table if exists public.teams drop constraint if exists teams_leader_id_fkey;
drop table if exists public.profiles;
drop table if exists public.teams;
drop table if exists public.roles;
drop table if exists public.org_settings;
