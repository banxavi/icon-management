import { canAdministerFolders, canManageFolder, canViewFolder, type FolderVisibility } from '@/lib/documents/access'
import { asRole, asStringArray } from '@/lib/data/rows'
import { getSql } from '@/lib/db'
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

export async function loadDocumentLibrary(session: SessionUser): Promise<DocumentLibraryData> {
  const sql = getSql()
  if (!sql) return { ...empty, configured: false }
  const canAdminister = canAdministerFolders(session.roles)

  let folderRows: Record<string, unknown>[] = []
  let setting: Record<string, unknown> | undefined
  try {
    ;[folderRows, setting] = await Promise.all([
      sql`select id, name, visibility, team_id from public.document_folders order by name`,
      sql`select max_upload_mb, allowed_extensions from public.org_settings limit 1`.then((rows) => rows[0]),
    ])
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    const missing = /document_folders|schema cache|does not exist|42P01/i.test(message)
    return { ...empty, configured: !missing, loadError: missing ? null : 'Could not load documents.', canAdminister }
  }

  const grantRows = await sql`select folder_id, user_id, access from public.document_folder_grants`
  const grants: FolderGrant[] = grantRows.flatMap((row) => {
    const access = row.access === 'manage' ? 'manage' : row.access === 'view' ? 'view' : null
    if (!access) return []
    return [{ folderId: String(row.folder_id), userId: String(row.user_id), access }]
  })

  const folders: LibraryFolder[] = folderRows.flatMap((folder) => {
    const id = String(folder.id)
    const visibility: FolderVisibility = folder.visibility === 'restricted' ? 'restricted' : 'team'
    const sameTeam = Boolean(session.teamId && folder.team_id === session.teamId)
    const hasViewGrant = grants.some((grant) => grant.folderId === id && grant.userId === session.id && grant.access === 'view')
    const hasManageGrant = grants.some((grant) => grant.folderId === id && grant.userId === session.id && grant.access === 'manage')
    const visible = canViewFolder({
      roles: session.roles,
      sameTeam,
      active: session.status === 'active',
      visibility,
      hasViewGrant,
      hasManageGrant,
    })
    if (!visible) return []
    return [{
      id,
      name: String(folder.name),
      visibility,
      canManage: canManageFolder({
        roles: session.roles,
        sameTeam,
        active: session.status === 'active',
        hasManageGrant,
      }),
    }]
  })

  const visibleFolderIds = new Set(folders.map((folder) => folder.id))
  const docs = await sql`
    select id, name, tags, folder_id, updated_at, current_version_id
    from public.documents
    where current_version_id is not null
    order by updated_at desc
  `
  const visibleDocs = docs.filter((doc) => visibleFolderIds.has(String(doc.folder_id || '')))
  const versionIds = visibleDocs.map((doc) => String(doc.current_version_id)).filter(Boolean)
  const versions = versionIds.length
    ? await sql`
        select id, version_label, file_name, created_at, uploaded_by
        from public.document_versions
        where id = any(${versionIds}::uuid[])
      `
    : []
  const versionById = new Map(versions.map((version) => [String(version.id), version]))
  const uploaderIds = [...new Set(versions.map((version) => String(version.uploaded_by || '')).filter(Boolean))]
  const uploaders = uploaderIds.length
    ? await sql`select id, full_name from public.profiles where id = any(${uploaderIds}::uuid[])`
    : []
  const uploaderNames = new Map(uploaders.map((person) => [String(person.id), String(person.full_name)]))
  const folderNames = new Map(folders.map((folder) => [folder.id, folder.name]))

  const documents: LibraryDocument[] = visibleDocs.map((doc) => {
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
    const [profiles, roleRows] = await Promise.all([
      sql`select id, full_name from public.profiles order by full_name`,
      sql`select ur.user_id, r.code from public.user_roles ur join public.roles r on r.id = ur.role_id`,
    ])
    const rolesByUser = new Map<string, AppRole[]>()
    for (const row of roleRows) {
      const code = asRole(row.code)
      if (!code) continue
      const userId = String(row.user_id)
      rolesByUser.set(userId, [...(rolesByUser.get(userId) ?? []), code])
    }
    people = profiles.map((person) => ({
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
