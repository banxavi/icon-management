-- DOC-01 / DOC-02 / ADM-01
-- Private document library, folder ACL, version history, and org upload settings.
-- Daily window and retention stay on org_settings (Asia/Saigon, 12 months, end of next day).
-- Down script: supabase/rollback/20261024203000_documents_and_settings.down.sql

alter table public.org_settings
  add column if not exists max_upload_mb integer not null default 50 check (max_upload_mb between 1 and 50),
  add column if not exists allowed_extensions text[] not null default array['pdf', 'docx', 'xlsx', 'pptx', 'md', 'png', 'jpg'];

create table public.document_folders (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id),
  name text not null,
  visibility text not null default 'team' check (visibility in ('team', 'restricted')),
  created_at timestamptz not null default now()
);

create unique index document_folders_team_name_idx on public.document_folders (team_id, lower(name));

-- view: member exception on a restricted folder.
-- manage: document owner may upload to this folder (team leader and admin do not need a row).
create table public.document_folder_grants (
  folder_id uuid not null references public.document_folders (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  access text not null check (access in ('view', 'manage')),
  primary key (folder_id, user_id, access)
);

alter table public.documents
  add column if not exists folder_id uuid references public.document_folders (id),
  add column if not exists current_version_id uuid;

alter table public.document_versions
  add column if not exists version_number integer,
  add column if not exists file_name text,
  add column if not exists mime_type text,
  add column if not exists byte_size bigint,
  add column if not exists ready boolean not null default false,
  add column if not exists restored_from uuid;

create index if not exists documents_folder_idx on public.documents (folder_id);
create index if not exists document_versions_document_idx on public.document_versions (document_id, version_number desc);
create index if not exists document_folder_grants_user_idx on public.document_folder_grants (user_id);

-- ---------------------------------------------------------------------------
-- Folder ACL. Must stay aligned with lib/documents/access.ts and the matrix:
-- Member views team folders plus explicit grants.
-- Reviewer, document owner, and team leader view every folder on their team.
-- Admin views all. Upload: admin, team leader, or document owner with manage.
-- ---------------------------------------------------------------------------

create or replace function public.can_view_folder(p_folder uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_active_user() and exists (
    select 1
    from public.document_folders f
    where f.id = p_folder
      and (
        public.has_role('admin')
        or (
          exists (
            select 1 from public.profiles me
            where me.id = auth.uid() and me.team_id = f.team_id
          )
          and (
            public.has_role('team_leader')
            or public.has_role('reviewer')
            or public.has_role('document_owner')
            or (
              f.visibility = 'team'
              and public.has_role('member')
            )
          )
        )
        or exists (
          select 1 from public.document_folder_grants g
          where g.folder_id = f.id
            and g.user_id = auth.uid()
            and g.access in ('view', 'manage')
        )
      )
  );
$$;

create or replace function public.can_manage_folder(p_folder uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_active_user() and exists (
    select 1
    from public.document_folders f
    where f.id = p_folder
      and (
        public.has_role('admin')
        or (
          public.has_role('team_leader')
          and exists (
            select 1 from public.profiles me
            where me.id = auth.uid() and me.team_id = f.team_id
          )
        )
        or (
          public.has_role('document_owner')
          and exists (
            select 1 from public.document_folder_grants g
            where g.folder_id = f.id
              and g.user_id = auth.uid()
              and g.access = 'manage'
          )
        )
      )
  );
$$;

create or replace function public.storage_folder_id(p_name text)
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  return split_part(p_name, '/', 1)::uuid;
exception when others then
  return null;
end;
$$;

create or replace function public.can_view_storage_path(p_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.can_view_folder(public.storage_folder_id(p_name));
$$;

create or replace function public.can_manage_storage_path(p_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.can_manage_folder(public.storage_folder_id(p_name));
$$;

create or replace function public.normalize_document_tags(p_tags text[])
returns text[]
language plpgsql
immutable
as $$
declare
  v_count integer;
  v_tags text[];
begin
  select count(*) into v_count
  from unnest(coalesce(p_tags, array[]::text[])) as tag
  where length(btrim(tag)) > 0;
  if v_count > 8 then
    raise exception 'TOO_MANY_TAGS' using errcode = '23514';
  end if;
  select coalesce(array_agg(left(btrim(tag), 40) order by ord), array[]::text[])
    into v_tags
  from unnest(coalesce(p_tags, array[]::text[])) with ordinality as t(tag, ord)
  where length(btrim(tag)) > 0;
  return v_tags;
end;
$$;

create or replace function public.begin_document_version(
  p_document_id uuid,
  p_folder_id uuid,
  p_name text,
  p_tags text[],
  p_file_name text,
  p_byte_size bigint,
  p_mime text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_doc uuid;
  v_version uuid;
  v_number integer;
  v_ext text;
  v_allowed text[];
  v_max integer;
  v_safe text;
  v_path text;
  v_tags text[];
  v_folder_name text;
begin
  if auth.uid() is null or not public.is_active_user() then
    raise exception 'UNAUTHENTICATED' using errcode = '42501';
  end if;
  if not public.can_manage_folder(p_folder_id) then
    perform public.audit_access_denied('document_folder', p_folder_id, jsonb_build_object('action', 'upload'));
    raise exception 'FOLDER_FORBIDDEN' using errcode = '42501';
  end if;
  if p_name is null or length(btrim(p_name)) < 2 or length(btrim(p_name)) > 160 then
    raise exception 'NAME_REQUIRED' using errcode = '23514';
  end if;
  if p_file_name is null or position('.' in p_file_name) = 0 then
    raise exception 'FILE_TYPE' using errcode = '23514';
  end if;

  v_ext := lower(regexp_replace(p_file_name, '^.*\.', ''));
  if v_ext = 'jpeg' then
    v_ext := 'jpg';
  end if;
  select allowed_extensions, max_upload_mb into v_allowed, v_max
  from public.org_settings
  limit 1;
  if v_allowed is null then
    v_allowed := array['pdf', 'docx', 'xlsx', 'pptx', 'md', 'png', 'jpg'];
  end if;
  if v_max is null then
    v_max := 50;
  end if;
  if not (v_ext = any (v_allowed)) then
    raise exception 'FILE_TYPE' using errcode = '23514';
  end if;
  if p_byte_size is null or p_byte_size <= 0 or p_byte_size > (v_max::bigint * 1024 * 1024) then
    raise exception 'FILE_TOO_LARGE' using errcode = '23514';
  end if;

  v_tags := public.normalize_document_tags(p_tags);
  select name into v_folder_name from public.document_folders where id = p_folder_id;

  if p_document_id is null then
    insert into public.documents (name, folder, folder_id, tags, owner_id)
    values (btrim(p_name), v_folder_name, p_folder_id, v_tags, auth.uid())
    returning id into v_doc;
    v_number := 1;
  else
    select id into v_doc
    from public.documents
    where id = p_document_id and folder_id = p_folder_id;
    if v_doc is null then
      raise exception 'NOT_FOUND' using errcode = 'P0002';
    end if;
    select coalesce(max(version_number), 0) + 1 into v_number
    from public.document_versions
    where document_id = v_doc;
  end if;

  v_version := gen_random_uuid();
  v_safe := regexp_replace(lower(btrim(p_file_name)), '[^a-z0-9._-]+', '-', 'g');
  v_safe := trim(both '-' from v_safe);
  if v_safe is null or v_safe = '' then
    v_safe := 'file';
  end if;
  if length(v_safe) > 120 then
    v_safe := right(v_safe, 120);
  end if;
  v_path := p_folder_id::text || '/' || v_doc::text || '/' || v_version::text || '/' || v_safe;

  insert into public.document_versions (
    id, document_id, version_label, version_number, storage_path, uploaded_by,
    file_name, mime_type, byte_size, ready
  ) values (
    v_version, v_doc, 'v' || v_number::text, v_number, v_path, auth.uid(),
    p_file_name, nullif(p_mime, ''), p_byte_size, false
  );

  return jsonb_build_object(
    'documentId', v_doc,
    'versionId', v_version,
    'path', v_path,
    'versionLabel', 'v' || v_number::text
  );
end;
$$;

create or replace function public.finalize_document_version(
  p_version_id uuid,
  p_name text,
  p_tags text[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_doc uuid;
  v_folder uuid;
  v_path text;
  v_ready boolean;
  v_tags text[];
  v_max integer;
  v_actual bigint;
begin
  if auth.uid() is null then
    raise exception 'UNAUTHENTICATED' using errcode = '42501';
  end if;
  select v.document_id, d.folder_id, v.storage_path, v.ready
    into v_doc, v_folder, v_path, v_ready
  from public.document_versions v
  join public.documents d on d.id = v.document_id
  where v.id = p_version_id;
  if v_doc is null then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;
  if not public.can_manage_folder(v_folder) then
    perform public.audit_access_denied('document', v_doc, jsonb_build_object('action', 'finalize'));
    raise exception 'FOLDER_FORBIDDEN' using errcode = '42501';
  end if;
  if v_ready then
    return;
  end if;
  if p_name is null or length(btrim(p_name)) < 2 or length(btrim(p_name)) > 160 then
    raise exception 'NAME_REQUIRED' using errcode = '23514';
  end if;
  select max_upload_mb into v_max from public.org_settings limit 1;
  if v_max is null then
    v_max := 50;
  end if;
  select nullif(metadata->>'size', '')::bigint into v_actual
  from storage.objects
  where bucket_id = 'documents' and name = v_path;
  if not found then
    raise exception 'UPLOAD_MISSING' using errcode = '23514';
  end if;
  if v_actual is not null and (v_actual <= 0 or v_actual > (v_max::bigint * 1024 * 1024)) then
    raise exception 'FILE_TOO_LARGE' using errcode = '23514';
  end if;
  v_tags := public.normalize_document_tags(p_tags);
  update public.document_versions set ready = true where id = p_version_id;
  update public.documents
    set name = btrim(p_name),
        tags = v_tags,
        current_version_id = p_version_id,
        updated_at = now()
    where id = v_doc;
  insert into public.audit_logs (actor_id, action, object_type, object_id, metadata)
  values (auth.uid(), 'document_uploaded', 'document', v_doc, jsonb_build_object('version_id', p_version_id));
end;
$$;

create or replace function public.abort_document_version(p_version_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_doc uuid;
  v_folder uuid;
begin
  if auth.uid() is null then
    raise exception 'UNAUTHENTICATED' using errcode = '42501';
  end if;
  select v.document_id, d.folder_id into v_doc, v_folder
  from public.document_versions v
  join public.documents d on d.id = v.document_id
  where v.id = p_version_id and v.ready = false and v.uploaded_by = auth.uid();
  if v_doc is null then
    return;
  end if;
  if not public.can_manage_folder(v_folder) then
    raise exception 'FOLDER_FORBIDDEN' using errcode = '42501';
  end if;
  delete from public.document_versions where id = p_version_id and ready = false;
  delete from public.documents d
  where d.id = v_doc
    and not exists (select 1 from public.document_versions v where v.document_id = d.id);
end;
$$;

create or replace function public.restore_document_version(p_version_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_doc uuid;
  v_folder uuid;
  v_number integer;
  v_new uuid;
  v_source public.document_versions;
begin
  if auth.uid() is null then
    raise exception 'UNAUTHENTICATED' using errcode = '42501';
  end if;
  select * into v_source from public.document_versions where id = p_version_id and ready = true;
  if v_source.id is null then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;
  select folder_id into v_folder from public.documents where id = v_source.document_id;
  v_doc := v_source.document_id;
  if not public.can_manage_folder(v_folder) then
    perform public.audit_access_denied('document', v_doc, jsonb_build_object('action', 'restore'));
    raise exception 'FOLDER_FORBIDDEN' using errcode = '42501';
  end if;
  select coalesce(max(version_number), 0) + 1 into v_number
  from public.document_versions where document_id = v_doc;
  v_new := gen_random_uuid();
  insert into public.document_versions (
    id, document_id, version_label, version_number, storage_path, uploaded_by,
    file_name, mime_type, byte_size, ready, restored_from
  ) values (
    v_new, v_doc, 'v' || v_number::text, v_number, v_source.storage_path, auth.uid(),
    v_source.file_name, v_source.mime_type, v_source.byte_size, true, v_source.id
  );
  update public.documents
    set current_version_id = v_new, updated_at = now()
    where id = v_doc;
  insert into public.audit_logs (actor_id, action, object_type, object_id, metadata)
  values (
    auth.uid(),
    'document_version_restored',
    'document',
    v_doc,
    jsonb_build_object('version_id', v_new, 'restored_from', v_source.id)
  );
  return v_new;
end;
$$;

create or replace function public.create_document_folder(p_name text, p_visibility text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team uuid;
  v_id uuid;
  v_name text;
begin
  if auth.uid() is null or not public.is_active_user() then
    raise exception 'UNAUTHENTICATED' using errcode = '42501';
  end if;
  if not (public.has_role('admin') or public.has_role('team_leader')) then
    perform public.audit_access_denied('document_folder', null, jsonb_build_object('action', 'create_folder'));
    raise exception 'FOLDER_FORBIDDEN' using errcode = '42501';
  end if;
  if p_visibility is null or p_visibility not in ('team', 'restricted') then
    raise exception 'VISIBILITY_INVALID' using errcode = '23514';
  end if;
  v_name := btrim(p_name);
  if v_name is null or length(v_name) < 2 or length(v_name) > 80 then
    raise exception 'NAME_REQUIRED' using errcode = '23514';
  end if;
  select team_id into v_team from public.profiles where id = auth.uid();
  if v_team is null then
    raise exception 'FOLDER_FORBIDDEN' using errcode = '42501';
  end if;
  insert into public.document_folders (team_id, name, visibility)
  values (v_team, v_name, p_visibility)
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.save_folder_access(
  p_folder uuid,
  p_visibility text,
  p_view uuid[],
  p_manage uuid[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team uuid;
begin
  if auth.uid() is null or not public.is_active_user() then
    raise exception 'UNAUTHENTICATED' using errcode = '42501';
  end if;
  select team_id into v_team from public.document_folders where id = p_folder;
  if v_team is null then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;
  if not (
    public.has_role('admin')
    or (
      public.has_role('team_leader')
      and exists (
        select 1 from public.profiles me
        where me.id = auth.uid() and me.team_id = v_team
      )
    )
  ) then
    perform public.audit_access_denied('document_folder', p_folder, jsonb_build_object('action', 'save_access'));
    raise exception 'FOLDER_FORBIDDEN' using errcode = '42501';
  end if;
  if p_visibility is null or p_visibility not in ('team', 'restricted') then
    raise exception 'VISIBILITY_INVALID' using errcode = '23514';
  end if;

  update public.document_folders set visibility = p_visibility where id = p_folder;
  delete from public.document_folder_grants where folder_id = p_folder;

  insert into public.document_folder_grants (folder_id, user_id, access)
  select p_folder, p.id, 'view'
  from public.profiles p
  where p.id = any (coalesce(p_view, array[]::uuid[]))
    and p.team_id = v_team
  on conflict do nothing;

  insert into public.document_folder_grants (folder_id, user_id, access)
  select p_folder, p.id, 'manage'
  from public.profiles p
  join public.user_roles ur on ur.user_id = p.id
  join public.roles r on r.id = ur.role_id and r.code = 'document_owner'
  where p.id = any (coalesce(p_manage, array[]::uuid[]))
    and p.team_id = v_team
  on conflict do nothing;

  insert into public.audit_logs (actor_id, action, object_type, object_id, metadata)
  values (
    auth.uid(),
    'folder_access_saved',
    'document_folder',
    p_folder,
    jsonb_build_object('visibility', p_visibility)
  );
end;
$$;

-- Members may edit contact and skills. Team leaders may rename a teammate.
-- Admins and service_role may change the remaining HR fields.
create or replace function public.protect_profile_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() = 'authenticated' and not public.has_role('admin') then
    if public.has_role('team_leader') and public.same_team(old.id) and old.id is distinct from auth.uid() then
      new.email := old.email;
      new.status := old.status;
      new.team_id := old.team_id;
      new.id := old.id;
    else
      new.full_name := old.full_name;
      new.email := old.email;
      new.status := old.status;
      new.team_id := old.team_id;
      new.id := old.id;
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.document_folders enable row level security;
alter table public.document_folder_grants enable row level security;

drop policy if exists documents_read on public.documents;
drop policy if exists documents_write on public.documents;
drop policy if exists document_versions_read on public.document_versions;
drop policy if exists document_versions_write on public.document_versions;
drop policy if exists profiles_update on public.profiles;

create policy documents_read on public.documents
  for select to authenticated
  using (folder_id is not null and public.can_view_folder(folder_id));

create policy document_versions_read on public.document_versions
  for select to authenticated
  using (
    exists (
      select 1 from public.documents d
      where d.id = document_versions.document_id
        and d.folder_id is not null
        and public.can_view_folder(d.folder_id)
    )
  );

create policy document_folders_read on public.document_folders
  for select to authenticated
  using (public.can_view_folder(id));

create policy document_folder_grants_read on public.document_folder_grants
  for select to authenticated
  using (
    user_id = auth.uid()
    or public.has_role('admin')
    or (
      public.has_role('team_leader')
      and exists (
        select 1
        from public.document_folders f
        join public.profiles me on me.id = auth.uid()
        where f.id = document_folder_grants.folder_id
          and me.team_id = f.team_id
      )
    )
  );

create policy profiles_update on public.profiles
  for update to authenticated
  using (
    id = auth.uid()
    or public.has_role('admin')
    or (public.has_role('team_leader') and public.same_team(id))
  )
  with check (
    id = auth.uid()
    or public.has_role('admin')
    or (public.has_role('team_leader') and public.same_team(id))
  );

revoke insert, update, delete on public.documents from anon, authenticated;
revoke insert, update, delete on public.document_versions from anon, authenticated;
revoke insert, update, delete on public.document_folders from anon, authenticated;
revoke insert, update, delete on public.document_folder_grants from anon, authenticated;

grant select on public.document_folders to authenticated;
grant select on public.document_folder_grants to authenticated;

revoke all on function public.can_view_folder(uuid) from public, anon;
revoke all on function public.can_manage_folder(uuid) from public, anon;
revoke all on function public.storage_folder_id(text) from public, anon;
revoke all on function public.can_view_storage_path(text) from public, anon;
revoke all on function public.can_manage_storage_path(text) from public, anon;
revoke all on function public.normalize_document_tags(text[]) from public, anon;
revoke all on function public.begin_document_version(uuid, uuid, text, text[], text, bigint, text) from public, anon;
revoke all on function public.finalize_document_version(uuid, text, text[]) from public, anon;
revoke all on function public.abort_document_version(uuid) from public, anon;
revoke all on function public.restore_document_version(uuid) from public, anon;
revoke all on function public.create_document_folder(text, text) from public, anon;
revoke all on function public.save_folder_access(uuid, text, uuid[], uuid[]) from public, anon;

grant execute on function public.begin_document_version(uuid, uuid, text, text[], text, bigint, text) to authenticated;
grant execute on function public.finalize_document_version(uuid, text, text[]) to authenticated;
grant execute on function public.abort_document_version(uuid) to authenticated;
grant execute on function public.restore_document_version(uuid) to authenticated;
grant execute on function public.create_document_folder(text, text) to authenticated;
grant execute on function public.save_folder_access(uuid, text, uuid[], uuid[]) to authenticated;

-- Private bucket. App code checks the configurable extension list and size.
insert into storage.buckets (id, name, public, file_size_limit)
values ('documents', 'documents', false, 52428800)
on conflict (id) do update
  set public = false,
      file_size_limit = 52428800;

drop policy if exists documents_storage_read on storage.objects;
drop policy if exists documents_storage_insert on storage.objects;

create policy documents_storage_read on storage.objects
  for select to authenticated
  using (bucket_id = 'documents' and public.can_view_storage_path(name));

create policy documents_storage_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'documents' and public.can_manage_storage_path(name));

insert into public.document_folders (id, team_id, name, visibility) values
  ('51000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'Policies', 'team'),
  ('51000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 'Process', 'team'),
  ('51000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001', 'Guides', 'team'),
  ('51000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000001', 'Projects', 'team'),
  ('51000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000001', 'Leadership', 'restricted');
