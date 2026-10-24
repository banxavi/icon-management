import { canAdministerFolders, canManageFolder, type FolderVisibility } from '@/lib/documents/access'
import { asRole, asStringArray } from '@/lib/data/rows'
import { createClient } from '@/lib/supabase/server'
import type { AppRole, SessionUser } from '@/lib/types'

export type LibraryFolder = {
  id: string
  name: string
  visibility: FolderVisibility
  canManage: boolean
}

export type LibraryDocument = {
  id: string
  name: string
  folderId: string
  folderName: string
  tags: string[]
  versionLabel: string
  updatedAt: string
  uploader: string
  fileName: string
}

export type LibraryPerson = {
  id: string
  fullName: string
  roles: AppRole[]
}

export type FolderGrant = {
  folderId: string
  userId: string
  access: 'view' | 'manage'
}

const fallbackExtensions = ['pdf', 'docx', 'xlsx', 'pptx', 'md', 'png', 'jpg']

export type DocumentLibraryData = {
  configured: boolean
  loadError: string | null
  folders: LibraryFolder[]
  documents: LibraryDocument[]
  people: LibraryPerson[]
  grants: FolderGrant[]
  canAdminister: boolean
  maxUploadMb: number
  allowedExtensions: string[]
}

const empty: DocumentLibraryData = {
  configured: true,
  loadError: null,
  folders: [],
  documents: [],
  people: [],
  grants: [],
  canAdminister: false,
  maxUploadMb: 50,
  allowedExtensions: fallbackExtensions,
}

function relatedCode(row: unknown): unknown {
  if (!row || typeof row !== 'object' || !('roles' in row)) return null
  const roles = (row as { roles?: { code?: string } | { code?: string }[] }).roles
  return Array.isArray(roles) ? roles[0]?.code : roles?.code
}

export async function loadDocumentLibrary(session: SessionUser): Promise<DocumentLibraryData> {
  const supabase = await createClient()
  if (!supabase) return { ...empty, configured: false }
  const canAdminister = canAdministerFolders(session.roles)

  const [{ data: folderRows, error: folderError }, { data: setting }] = await Promise.all([
    supabase.from('document_folders').select('id, name, visibility, team_id').order('name'),
    supabase.from('org_settings').select('max_upload_mb, allowed_extensions').limit(1).maybeSingle(),
  ])
  if (folderError) {
    const missing = /document_folders|schema cache|does not exist|42P01/i.test(folderError.message)
    return { ...empty, configured: !missing, loadError: missing ? null : 'Could not load documents.', canAdminister }
  }

  const { data: grantRows } = await supabase.from('document_folder_grants').select('folder_id, user_id, access')
  const grants: FolderGrant[] = (grantRows ?? []).flatMap((row) => {
    const access = row.access === 'manage' ? 'manage' : row.access === 'view' ? 'view' : null
    if (!access) return []
    return [{ folderId: String(row.folder_id), userId: String(row.user_id), access }]
  })

  const folders: LibraryFolder[] = (folderRows ?? []).map((folder) => {
    const id = String(folder.id)
    return {
      id,
      name: String(folder.name),
      visibility: folder.visibility === 'restricted' ? 'restricted' : 'team',
      canManage: canManageFolder({
        roles: session.roles,
        sameTeam: Boolean(session.teamId && folder.team_id === session.teamId),
        active: session.status === 'active',
        hasManageGrant: grants.some((grant) => grant.folderId === id && grant.userId === session.id && grant.access === 'manage'),
      }),
    }
  })

  const { data: docs } = await supabase
    .from('documents')
    .select('id, name, tags, folder_id, updated_at, current_version_id')
    .not('current_version_id', 'is', null)
    .order('updated_at', { ascending: false })

  const versionIds = (docs ?? []).map((doc) => String(doc.current_version_id)).filter(Boolean)
  const { data: versions } = versionIds.length
    ? await supabase.from('document_versions').select('id, version_label, file_name, created_at, uploaded_by').in('id', versionIds)
    : { data: [] }
  const versionById = new Map((versions ?? []).map((version) => [String(version.id), version]))
  const uploaderIds = [...new Set((versions ?? []).map((version) => String(version.uploaded_by || '')).filter(Boolean))]
  const { data: uploaders } = uploaderIds.length
    ? await supabase.from('profiles').select('id, full_name').in('id', uploaderIds)
    : { data: [] }
  const uploaderNames = new Map((uploaders ?? []).map((person) => [String(person.id), String(person.full_name)]))
  const folderNames = new Map(folders.map((folder) => [folder.id, folder.name]))

  const documents: LibraryDocument[] = (docs ?? []).map((doc) => {
    const version = versionById.get(String(doc.current_version_id))
    const uploaderId = version ? String(version.uploaded_by || '') : ''
    return {
      id: String(doc.id),
      name: String(doc.name),
      folderId: String(doc.folder_id || ''),
      folderName: folderNames.get(String(doc.folder_id || '')) || 'Folder',
      tags: asStringArray(doc.tags),
      versionLabel: version ? String(version.version_label || '') : '',
      updatedAt: String(doc.updated_at || version?.created_at || ''),
      uploader: uploaderNames.get(uploaderId) || 'Member',
      fileName: version ? String(version.file_name || '') : '',
    }
  })

  let people: LibraryPerson[] = []
  if (canAdminister) {
    const [{ data: profiles }, { data: roleRows }] = await Promise.all([
      supabase.from('profiles').select('id, full_name').order('full_name'),
      supabase.from('user_roles').select('user_id, roles(code)'),
    ])
    const rolesByUser = new Map<string, AppRole[]>()
    for (const row of roleRows ?? []) {
      const code = asRole(relatedCode(row))
      if (!code) continue
      const userId = String((row as { user_id: string }).user_id)
      rolesByUser.set(userId, [...(rolesByUser.get(userId) ?? []), code])
    }
    people = (profiles ?? []).map((person) => ({
      id: String(person.id),
      fullName: String(person.full_name),
      roles: rolesByUser.get(String(person.id)) ?? [],
    }))
  }

  return {
    configured: true,
    loadError: null,
    folders,
    documents,
    people,
    grants: canAdminister ? grants : [],
    canAdminister,
    maxUploadMb: Number(setting?.max_upload_mb ?? 50),
    allowedExtensions: Array.isArray(setting?.allowed_extensions) && setting.allowed_extensions.length > 0
      ? setting.allowed_extensions.map(String)
      : fallbackExtensions,
  }
}
