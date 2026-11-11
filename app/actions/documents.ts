'use server'

import { revalidatePath } from 'next/cache'
import { requireSession } from '@/lib/auth/session'
import { canAdministerFolders, canManageFolder, canViewFolder } from '@/lib/documents/access'
import { mapDocumentError } from '@/lib/documents/messages'
import { parseTags, previewKind, validateDocumentName, validateUpload, type PreviewKind } from '@/lib/documents/rules'
import { getSql, withAuthUid } from '@/lib/db'
import { messages } from '@/lib/messages'

export type DocumentActionResult = { ok: true; message?: string } | { ok: false; error: string }

export type PreparedUpload = {
  ok: true
  documentId: string
  versionId: string
  path: string
  token: string
}

export type DocumentVersionView = {
  id: string
  label: string
  fileName: string
  createdAt: string
  uploader: string
  byteSize: number
  previewKind: PreviewKind
  signedUrl: string | null
  textPreview: string | null
  restored: boolean
  current: boolean
}

export type DocumentDetail = {
  id: string
  name: string
  tags: string[]
  folderId: string
  folderName: string
  canManage: boolean
  versions: DocumentVersionView[]
}

function refresh() {
  revalidatePath('/documents')
}

const STORAGE_UNAVAILABLE =
  'Document file storage is not on Neon yet. Metadata works; uploads/downloads need Neon Object Storage (follow-up).'

async function uploadLimits() {
  const sql = getSql()
  if (!sql) return null
  const rows = await sql`select max_upload_mb, allowed_extensions from public.org_settings limit 1`
  const data = rows[0]
  return {
    sql,
    maxUploadMb: Number(data?.max_upload_mb ?? 50),
    allowedExtensions: Array.isArray(data?.allowed_extensions)
      ? data.allowed_extensions.map(String)
      : ['pdf', 'docx', 'xlsx', 'pptx', 'md', 'png', 'jpg'],
  }
}

export async function prepareDocumentUpload(input: {
  documentId: string | null
  folderId: string
  name: string
  tags: string
  fileName: string
  byteSize: number
  mimeType: string
}): Promise<PreparedUpload | { ok: false; error: string }> {
  await requireSession()
  const nameError = validateDocumentName(input.name)
  if (nameError) return { ok: false, error: nameError }
  const tags = parseTags(input.tags)
  if (!tags.ok) return { ok: false, error: tags.error }
  const limits = await uploadLimits()
  if (!limits) return { ok: false, error: messages.saveFailed }
  const file = validateUpload({
    fileName: input.fileName,
    byteSize: input.byteSize,
    allowedExtensions: limits.allowedExtensions,
    maxUploadMb: limits.maxUploadMb,
  })
  if (!file.ok) return { ok: false, error: mapDocumentError(file.code) }
  return { ok: false, error: STORAGE_UNAVAILABLE }
}

export async function finalizeDocumentUpload(_input: {
  versionId: string
  name: string
  tags: string
}): Promise<DocumentActionResult> {
  await requireSession()
  return { ok: false, error: STORAGE_UNAVAILABLE }
}

export async function abortDocumentUpload(versionId: string): Promise<void> {
  const session = await requireSession()
  try {
    await withAuthUid(session.id, (sql) => sql`select public.abort_document_version(${versionId}::uuid)`)
  } catch {
    // ignore
  }
}

export async function restoreDocumentVersion(versionId: string): Promise<DocumentActionResult> {
  const session = await requireSession()
  try {
    await withAuthUid(session.id, (sql) => sql`select public.restore_document_version(${versionId}::uuid)`)
    refresh()
    return { ok: true, message: messages.documentRestored }
  } catch (error) {
    return { ok: false, error: mapDocumentError(error instanceof Error ? error.message : messages.saveFailed) }
  }
}

export async function createFolder(formData: FormData): Promise<DocumentActionResult> {
  const session = await requireSession()
  if (!canAdministerFolders(session.roles)) return { ok: false, error: messages.folderForbidden }
  try {
    await withAuthUid(
      session.id,
      (sql) => sql`select public.create_document_folder(${String(formData.get('name') || '')}, ${String(formData.get('visibility') || 'team')})`,
    )
    refresh()
    return { ok: true, message: messages.folderCreated }
  } catch (error) {
    return { ok: false, error: mapDocumentError(error instanceof Error ? error.message : messages.saveFailed) }
  }
}

export async function saveFolderAccess(formData: FormData): Promise<DocumentActionResult> {
  const session = await requireSession()
  if (!canAdministerFolders(session.roles)) return { ok: false, error: messages.folderForbidden }
  try {
    await withAuthUid(
      session.id,
      (sql) => sql`
        select public.save_folder_access(
          ${String(formData.get('folderId') || '')}::uuid,
          ${String(formData.get('visibility') || 'team')},
          ${formData.getAll('view').map(String)}::uuid[],
          ${formData.getAll('manage').map(String)}::uuid[]
        )
      `,
    )
    refresh()
    return { ok: true, message: messages.folderAccessSaved }
  } catch (error) {
    return { ok: false, error: mapDocumentError(error instanceof Error ? error.message : messages.saveFailed) }
  }
}

export async function loadDocumentDetail(
  id: string,
): Promise<{ ok: true; detail: DocumentDetail } | { ok: false; error: string }> {
  const session = await requireSession()
  const sql = getSql()
  if (!sql) return { ok: false, error: messages.saveFailed }

  const docs = await sql`
    select d.id, d.name, d.tags, d.folder_id, d.current_version_id, f.name as folder_name, f.team_id, f.visibility
    from public.documents d
    join public.document_folders f on f.id = d.folder_id
    where d.id = ${id}::uuid
    limit 1
  `
  const document = docs[0]
  if (!document || !document.folder_id) {
    if (/^[0-9a-f-]{36}$/i.test(id)) {
      try {
        await withAuthUid(
          session.id,
          (authSql) => authSql`select public.audit_access_denied('document', ${id}::uuid, ${JSON.stringify({ path: '/documents' })}::jsonb)`,
        )
      } catch {
        // ignore
      }
    }
    return { ok: false, error: messages.documentForbidden }
  }

  const grantRows = await sql`
    select access from public.document_folder_grants
    where folder_id = ${document.folder_id}::uuid and user_id = ${session.id}::uuid
  `
  const hasViewGrant = grantRows.some((row) => row.access === 'view')
  const hasManageGrant = grantRows.some((row) => row.access === 'manage')
  const sameTeam = Boolean(session.teamId && document.team_id === session.teamId)
  const visibility = document.visibility === 'restricted' ? 'restricted' as const : 'team' as const
  const allowed = canViewFolder({
    roles: session.roles,
    sameTeam,
    active: session.status === 'active',
    visibility,
    hasViewGrant,
    hasManageGrant,
  })
  if (!allowed) {
    try {
      await withAuthUid(
        session.id,
        (authSql) => authSql`select public.audit_access_denied('document', ${id}::uuid, ${JSON.stringify({ path: '/documents', reason: 'folder_acl' })}::jsonb)`,
      )
    } catch {
      // ignore
    }
    return { ok: false, error: messages.documentForbidden }
  }

  const versions = await sql`
    select id, version_label, file_name, byte_size, created_at, uploaded_by, storage_path, restored_from
    from public.document_versions
    where document_id = ${id}::uuid and ready = true
    order by version_number desc
  `
  const uploaderIds = [...new Set(versions.map((version) => String(version.uploaded_by || '')).filter(Boolean))]
  const profiles = uploaderIds.length
    ? await sql`select id, full_name from public.profiles where id = any(${uploaderIds}::uuid[])`
    : []
  const names = new Map(profiles.map((profile) => [String(profile.id), String(profile.full_name)]))
  const canManage = canManageFolder({
    roles: session.roles,
    sameTeam,
    active: session.status === 'active',
    hasManageGrant,
  })

  const views: DocumentVersionView[] = versions.map((version) => {
    const fileName = String(version.file_name || 'file')
    return {
      id: String(version.id),
      label: String(version.version_label || ''),
      fileName,
      createdAt: String(version.created_at),
      uploader: names.get(String(version.uploaded_by)) || 'Member',
      byteSize: Number(version.byte_size || 0),
      previewKind: previewKind(fileName),
      signedUrl: null,
      textPreview: null,
      restored: Boolean(version.restored_from),
      current: String(version.id) === String(document.current_version_id),
    }
  })

  return {
    ok: true,
    detail: {
      id: String(document.id),
      name: String(document.name),
      tags: Array.isArray(document.tags) ? document.tags.map(String) : [],
      folderId: String(document.folder_id),
      folderName: String(document.folder_name || 'Folder'),
      canManage,
      versions: views,
    },
  }
}
