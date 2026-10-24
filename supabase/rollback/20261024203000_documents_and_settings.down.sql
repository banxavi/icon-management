-- Rollback for 20261024203000_documents_and_settings.sql
-- Removes the document library, folder ACL, upload settings, and storage policies.
-- Does not delete auth users or daily reports. Take a backup first.

drop policy if exists documents_storage_read on storage.objects;
drop policy if exists documents_storage_insert on storage.objects;
delete from storage.objects where bucket_id = 'documents';
delete from storage.buckets where id = 'documents';

drop function if exists public.save_folder_access(uuid, text, uuid[], uuid[]);
drop function if exists public.create_document_folder(text, text);
drop function if exists public.restore_document_version(uuid);
drop function if exists public.abort_document_version(uuid);
drop function if exists public.finalize_document_version(uuid, text, text[]);
drop function if exists public.begin_document_version(uuid, uuid, text, text[], text, bigint, text);
drop function if exists public.normalize_document_tags(text[]);
drop function if exists public.can_manage_storage_path(text);
drop function if exists public.can_view_storage_path(text);
drop function if exists public.storage_folder_id(text);
drop function if exists public.can_manage_folder(uuid);
drop function if exists public.can_view_folder(uuid);

drop policy if exists document_folder_grants_read on public.document_folder_grants;
drop policy if exists document_folders_read on public.document_folders;
drop policy if exists document_versions_read on public.document_versions;
drop policy if exists documents_read on public.documents;

alter table public.documents drop column if exists current_version_id;
alter table public.documents drop column if exists folder_id;
alter table public.document_versions drop column if exists restored_from;
alter table public.document_versions drop column if exists ready;
alter table public.document_versions drop column if exists byte_size;
alter table public.document_versions drop column if exists mime_type;
alter table public.document_versions drop column if exists file_name;
alter table public.document_versions drop column if exists version_number;

drop table if exists public.document_folder_grants;
drop table if exists public.document_folders;

alter table public.org_settings drop column if exists allowed_extensions;
alter table public.org_settings drop column if exists max_upload_mb;

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

grant insert, update, delete on public.documents to authenticated;
grant insert, update, delete on public.document_versions to authenticated;

create or replace function public.protect_profile_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
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

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles
  for update to authenticated
  using (id = auth.uid() or public.has_role('admin'))
  with check (id = auth.uid() or public.has_role('admin'));
