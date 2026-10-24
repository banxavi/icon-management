'use server'

import { revalidatePath } from 'next/cache'
import { requireSession } from '@/lib/auth/session'
import { canAdministerFolders, canManageFolder } from '@/lib/documents/access'
import { mapDocumentError } from '@/lib/documents/messages'
import { parseTags, previewKind, validateDocumentName, validateUpload, type PreviewKind } from '@/lib/documents/rules'
import { messages } from '@/lib/messages'
import { createClient } from '@/lib/supabase/server'

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

const MARKDOWN_PREVIEW_LIMIT = 200_000

function refresh() {
  revalidatePath('/documents')
}

async function uploadLimits() {
  const supabase = await createClient()
  if (!supabase) return null
  const { data } = await supabase.from('org_settings').select('max_upload_mb, allowed_extensions').limit(1).maybeSingle()
  return {
    supabase,
    maxUploadMb: Number(data?.max_upload_mb ?? 50),
    allowedExtensions: Array.isArray(data?.allowed_extensions) ? data.allowed_extensions.map(String) : ['pdf', 'docx', 'xlsx', 'pptx', 'md', 'png', 'jpg'],
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

  const { data, error } = await limits.supabase.rpc('begin_document_version', {
    p_document_id: input.documentId,
    p_folder_id: input.folderId,
    p_name: input.name.trim(),
    p_tags: tags.tags,
    p_file_name: input.fileName,
    p_byte_size: input.byteSize,
    p_mime: input.mimeType,
  })
  if (error || !data) return { ok: false, error: mapDocumentError(error?.message ?? '') }
  const payload = data as { documentId?: string; versionId?: string; path?: string }
  if (!payload.documentId || !payload.versionId || !payload.path) return { ok: false, error: messages.saveFailed }

  const signed = await limits.supabase.storage.from('documents').createSignedUploadUrl(payload.path)
  if (signed.error || !signed.data?.token) {
    await limits.supabase.rpc('abort_document_version', { p_version_id: payload.versionId })
    return { ok: false, error: messages.uploadUnavailable }
  }
  return {
    ok: true,
    documentId: payload.documentId,
    versionId: payload.versionId,
    path: payload.path,
    token: signed.data.token,
  }
}

export async function finalizeDocumentUpload(input: {
  versionId: string
  name: string
  tags: string
}): Promise<DocumentActionResult> {
  await requireSession()
  const tags = parseTags(input.tags)
  if (!tags.ok) return { ok: false, error: tags.error }
  const supabase = await createClient()
  if (!supabase) return { ok: false, error: messages.saveFailed }
  const { error } = await supabase.rpc('finalize_document_version', {
    p_version_id: input.versionId,
    p_name: input.name.trim(),
    p_tags: tags.tags,
  })
  if (error) return { ok: false, error: mapDocumentError(error.message) }
  refresh()
  return { ok: true, message: messages.documentSaved }
}

export async function abortDocumentUpload(versionId: string): Promise<void> {
  await requireSession()
  const supabase = await createClient()
  if (!supabase) return
  await supabase.rpc('abort_document_version', { p_version_id: versionId })
}

export async function restoreDocumentVersion(versionId: string): Promise<DocumentActionResult> {
  await requireSession()
  const supabase = await createClient()
  if (!supabase) return { ok: false, error: messages.saveFailed }
  const { error } = await supabase.rpc('restore_document_version', { p_version_id: versionId })
  if (error) return { ok: false, error: mapDocumentError(error.message) }
  refresh()
  return { ok: true, message: messages.documentRestored }
}

export async function createFolder(formData: FormData): Promise<DocumentActionResult> {
  const session = await requireSession()
  if (!canAdministerFolders(session.roles)) return { ok: false, error: messages.folderForbidden }
  const supabase = await createClient()
  if (!supabase) return { ok: false, error: messages.saveFailed }
  const { error } = await supabase.rpc('create_document_folder', {
    p_name: String(formData.get('name') || ''),
    p_visibility: String(formData.get('visibility') || 'team'),
  })
  if (error) return { ok: false, error: mapDocumentError(error.message) }
  refresh()
  return { ok: true, message: messages.folderCreated }
}

export async function saveFolderAccess(formData: FormData): Promise<DocumentActionResult> {
  const session = await requireSession()
  if (!canAdministerFolders(session.roles)) return { ok: false, error: messages.folderForbidden }
  const supabase = await createClient()
  if (!supabase) return { ok: false, error: messages.saveFailed }
  const { error } = await supabase.rpc('save_folder_access', {
    p_folder: String(formData.get('folderId') || ''),
    p_visibility: String(formData.get('visibility') || 'team'),
    p_view: formData.getAll('view').map(String),
    p_manage: formData.getAll('manage').map(String),
  })
  if (error) return { ok: false, error: mapDocumentError(error.message) }
  refresh()
  return { ok: true, message: messages.folderAccessSaved }
}

export async function loadDocumentDetail(id: string): Promise<{ ok: true; detail: DocumentDetail } | { ok: false; error: string }> {
  const session = await requireSession()
  const supabase = await createClient()
  if (!supabase) return { ok: false, error: messages.saveFailed }

  const { data: document } = await supabase
    .from('documents')
    .select('id, name, tags, folder_id, current_version_id, document_folders(name)')
    .eq('id', id)
    .maybeSingle()
  if (!document || !document.folder_id) {
    if (/^[0-9a-f-]{36}$/i.test(id)) {
      await supabase.rpc('audit_access_denied', {
        p_object_type: 'document',
        p_object_id: id,
        p_metadata: { path: '/documents' },
      })
    }
    return { ok: false, error: messages.documentForbidden }
  }

  const { data: versions } = await supabase
    .from('document_versions')
    .select('id, version_label, file_name, byte_size, created_at, uploaded_by, storage_path, restored_from')
    .eq('document_id', id)
    .eq('ready', true)
    .order('version_number', { ascending: false })

  const uploaderIds = [...new Set((versions ?? []).map((version) => String(version.uploaded_by || '')).filter(Boolean))]
  const { data: profiles } = uploaderIds.length
    ? await supabase.from('profiles').select('id, full_name').in('id', uploaderIds)
    : { data: [] }
  const names = new Map((profiles ?? []).map((profile) => [String(profile.id), String(profile.full_name)]))

  const { data: manageGrant } = await supabase
    .from('document_folder_grants')
    .select('access')
    .eq('folder_id', document.folder_id)
    .eq('user_id', session.id)
    .eq('access', 'manage')
    .maybeSingle()
  const { data: folder } = await supabase.from('document_folders').select('team_id').eq('id', document.folder_id).maybeSingle()
  const canManage = canManageFolder({
    roles: session.roles,
    sameTeam: Boolean(session.teamId && folder?.team_id === session.teamId),
    active: session.status === 'active',
    hasManageGrant: Boolean(manageGrant),
  })

  const folderRelation = document.document_folders as { name?: string } | { name?: string }[] | null
  const folderName = Array.isArray(folderRelation) ? folderRelation[0]?.name : folderRelation?.name

  const views: DocumentVersionView[] = []
  for (const version of versions ?? []) {
    const fileName = String(version.file_name || 'file')
    const kind = previewKind(fileName)
    const path = String(version.storage_path || '')
    const signed = path ? await supabase.storage.from('documents').createSignedUrl(path, 600) : { data: null }
    let textPreview: string | null = null
    const current = String(version.id) === String(document.current_version_id)
    if (current && kind === 'markdown' && Number(version.byte_size || 0) <= MARKDOWN_PREVIEW_LIMIT && path) {
      const downloaded = await supabase.storage.from('documents').download(path)
      if (downloaded.data) textPreview = await downloaded.data.text()
    }
    views.push({
      id: String(version.id),
      label: String(version.version_label || ''),
      fileName,
      createdAt: String(version.created_at),
      uploader: names.get(String(version.uploaded_by)) || 'Member',
      byteSize: Number(version.byte_size || 0),
      previewKind: kind,
      signedUrl: signed.data?.signedUrl ?? null,
      textPreview,
      restored: Boolean(version.restored_from),
      current,
    })
  }

  return {
    ok: true,
    detail: {
      id: String(document.id),
      name: String(document.name),
      tags: Array.isArray(document.tags) ? document.tags.map(String) : [],
      folderId: String(document.folder_id),
      folderName: folderName || 'Folder',
      canManage,
      versions: views,
    },
  }
}
