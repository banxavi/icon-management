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
  let settingRows: Record<string, unknown>[] = []
  let grantRows: Record<string, unknown>[] = []
  try {
    // One HTTP round-trip for the three independent lookups.
    ;[folderRows, settingRows, grantRows] = await sql.transaction([
      sql`select id, name, visibility, team_id from public.document_folders order by name`,
      sql`select max_upload_mb, allowed_extensions from public.org_settings limit 1`,
      sql`select folder_id, user_id, access from public.document_folder_grants`,
    ])
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    const missing = /document_folders|schema cache|does not exist|42P01/i.test(message)
    return { ...empty, configured: !missing, loadError: missing ? null : 'Could not load documents.', canAdminister }
  }

  const setting = settingRows[0]
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
  const folderNames = new Map(folders.map((folder) => [folder.id, folder.name]))

  // Collapse docs → versions → uploaders into one joined query; fetch admin people in parallel.
  const docsPromise = sql`
    select
      d.id,
      d.name,
      d.tags,
      d.folder_id,
      d.updated_at,
      d.current_version_id,
      v.version_label,
      v.file_name,
      v.created_at as version_created_at,
      pr.full_name as uploader_name
    from public.documents d
    left join public.document_versions v on v.id = d.current_version_id
    left join public.profiles pr on pr.id = v.uploaded_by
    where d.current_version_id is not null
    order by d.updated_at desc
  `

  const peoplePromise = canAdminister
    ? sql.transaction([
        sql`select id, full_name from public.profiles order by full_name`,
        sql`select ur.user_id, r.code from public.user_roles ur join public.roles r on r.id = ur.role_id`,
      ])
    : Promise.resolve(null)

  const [docs, peopleBundle] = await Promise.all([docsPromise, peoplePromise])

  const documents: LibraryDocument[] = docs
    .filter((doc) => visibleFolderIds.has(String(doc.folder_id || '')))
    .map((doc) => ({
      id: String(doc.id),
      name: String(doc.name),
      folderId: String(doc.folder_id || ''),
      folderName: folderNames.get(String(doc.folder_id || '')) || 'Folder',
      tags: asStringArray(doc.tags),
      versionLabel: doc.version_label ? String(doc.version_label) : '',
      updatedAt: String(doc.updated_at || doc.version_created_at || ''),
      uploader: doc.uploader_name ? String(doc.uploader_name) : 'Member',
      fileName: doc.file_name ? String(doc.file_name) : '',
    }))

  let people: LibraryPerson[] = []
  if (peopleBundle) {
    const [profiles, roleRows] = peopleBundle
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
