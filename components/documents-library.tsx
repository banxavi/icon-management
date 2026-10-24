'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { FileText, Folder, Search } from 'lucide-react'
import {
  abortDocumentUpload,
  createFolder,
  finalizeDocumentUpload,
  loadDocumentDetail,
  prepareDocumentUpload,
  restoreDocumentVersion,
  saveFolderAccess,
  type DocumentDetail,
} from '@/app/actions/documents'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import type { FolderGrant, LibraryDocument, LibraryFolder, LibraryPerson } from '@/lib/data/documents'
import { acceptAttribute } from '@/lib/documents/rules'
import { roleLabel } from '@/lib/auth/permissions'
import { messages } from '@/lib/messages'
import { createBrowserSupabase } from '@/lib/supabase/client'

function formatWhen(value: string) {
  if (!value) return ''
  return new Date(value).toLocaleString('en-US', { timeZone: 'Asia/Saigon' })
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function DocumentsLibrary({
  configured,
  loadError,
  folders,
  documents,
  people,
  grants,
  canAdminister,
  maxUploadMb,
  allowedExtensions,
}: {
  configured: boolean
  loadError: string | null
  folders: LibraryFolder[]
  documents: LibraryDocument[]
  people: LibraryPerson[]
  grants: FolderGrant[]
  canAdminister: boolean
  maxUploadMb: number
  allowedExtensions: string[]
}) {
  const router = useRouter()
  const [folderId, setFolderId] = useState('all')
  const [query, setQuery] = useState('')
  const [detail, setDetail] = useState<DocumentDetail | null>(null)
  const [detailError, setDetailError] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const manageable = folders.filter((folder) => folder.canManage)
  const visible = documents.filter((document) => {
    const inFolder = folderId === 'all' || document.folderId === folderId
    const haystack = `${document.name} ${document.tags.join(' ')}`.toLowerCase()
    return inFolder && haystack.includes(query.trim().toLowerCase())
  })

  async function upload(file: File, targetFolder: string, name: string, tags: string, documentId: string | null) {
    setPending(true)
    setError('')
    setMessage('')
    const prepared = await prepareDocumentUpload({
      documentId,
      folderId: targetFolder,
      name,
      tags,
      fileName: file.name,
      byteSize: file.size,
      mimeType: file.type,
    })
    if (!prepared.ok) {
      setPending(false)
      setError(prepared.error)
      return false
    }
    const browser = createBrowserSupabase()
    if (!browser) {
      await abortDocumentUpload(prepared.versionId)
      setPending(false)
      setError(messages.uploadUnavailable)
      return false
    }
    const uploaded = await browser.storage.from('documents').uploadToSignedUrl(prepared.path, prepared.token, file, {
      contentType: file.type || undefined,
    })
    if (uploaded.error) {
      await abortDocumentUpload(prepared.versionId)
      setPending(false)
      setError(messages.uploadMissing)
      return false
    }
    const saved = await finalizeDocumentUpload({ versionId: prepared.versionId, name, tags })
    setPending(false)
    if (!saved.ok) {
      await abortDocumentUpload(prepared.versionId)
      setError(saved.error)
      return false
    }
    setMessage(saved.message || messages.documentSaved)
    router.refresh()
    return true
  }

  async function openDocument(id: string) {
    setDetailError('')
    const result = await loadDocumentDetail(id)
    if (!result.ok) {
      setDetail(null)
      setDetailError(result.error)
      return
    }
    setDetail(result.detail)
  }

  if (!configured) {
    return (
      <div>
        <LibraryHeading />
        <p className="mt-6 text-sm text-slate-600">The document library is not available until the latest database migration is applied.</p>
      </div>
    )
  }

  return (
    <div>
      <LibraryHeading />
      <p className="mt-2 max-w-3xl text-sm text-slate-500">
        Members see team folders, plus any restricted folder a Team Leader or Admin has granted. Reviewers, document owners, the team leader, and admins can view every folder on the team. Upload is limited to the team leader, an admin, or a document owner assigned to that folder.
      </p>
      {loadError && <p className="mt-4 text-sm text-red-600">{loadError}</p>}
      {message && <p className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{message}</p>}
      {error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <div className="mt-6 flex flex-col gap-6 lg:flex-row">
        <Card className="h-fit lg:w-60">
          <CardHeader><CardTitle className="text-sm">Folders</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-1 text-sm">
            <FolderButton active={folderId === 'all'} label="All documents" onClick={() => setFolderId('all')} />
            {folders.map((folder) => (
              <FolderButton
                key={folder.id}
                active={folderId === folder.id}
                label={`${folder.name}${folder.visibility === 'restricted' ? ' · Restricted' : ''}`}
                onClick={() => setFolderId(folder.id)}
              />
            ))}
          </CardContent>
        </Card>
        <div className="min-w-0 flex-1">
          {manageable.length > 0 && (
            <Card className="mb-4">
              <CardHeader><CardTitle className="text-base">Upload</CardTitle></CardHeader>
              <CardContent>
                <p className="mb-3 text-sm text-slate-500">Up to {maxUploadMb} MB. Allowed: {allowedExtensions.join(', ')}. A new file keeps the previous versions.</p>
                <form
                  className="grid gap-3 md:grid-cols-2"
                  onSubmit={async (event) => {
                    event.preventDefault()
                    const form = event.currentTarget
                    const data = new FormData(form)
                    const file = data.get('file')
                    if (!(file instanceof File) || file.size === 0) {
                      setError(messages.fileTooLarge)
                      return
                    }
                    const ok = await upload(file, String(data.get('folderId') || ''), String(data.get('name') || ''), String(data.get('tags') || ''), null)
                    if (ok) form.reset()
                  }}
                >
                  <label className="text-sm">Folder
                    <select name="folderId" className="mt-1 block h-9 w-full rounded-lg border px-2" defaultValue={manageable[0]?.id}>
                      {manageable.map((folder) => <option key={folder.id} value={folder.id}>{folder.name}</option>)}
                    </select>
                  </label>
                  <label className="text-sm">Name
                    <Input name="name" required className="mt-1" placeholder="WFH policy" />
                  </label>
                  <label className="text-sm md:col-span-2">Tags
                    <Input name="tags" className="mt-1" placeholder="Comma-separated, for example WFH, Reports" />
                  </label>
                  <label className="text-sm md:col-span-2">File
                    <input name="file" type="file" required accept={acceptAttribute(allowedExtensions)} className="mt-1 block w-full text-sm" />
                  </label>
                  <Button type="submit" disabled={pending} className="w-fit bg-[#1b2a41]">Upload</Button>
                </form>
              </CardContent>
            </Card>
          )}
          {manageable.length === 0 && folders.some((folder) => folder.canManage) === false && (
            <p className="mb-4 text-sm text-slate-500">You can view documents in the folders listed here. Upload is available to a Document Owner on an assigned folder, the Team Leader, or an Admin.</p>
          )}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-2.5 size-4 text-slate-400" />
            <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by name or tag..." className="bg-white pl-9" aria-label="Search documents" />
          </div>
          <Card>
            <CardContent className="p-0">
              {visible.length === 0 && <p className="p-6 text-sm text-slate-500">No documents in this folder yet.</p>}
              {visible.map((document) => (
                <button key={document.id} type="button" onClick={() => void openDocument(document.id)} className="grid w-full grid-cols-1 gap-2 border-b px-5 py-4 text-left hover:bg-slate-50 md:grid-cols-[1fr_90px_160px_180px] md:items-center">
                  <span className="flex items-start gap-3">
                    <FileText className="mt-0.5 size-4" />
                    <span>
                      <span className="block font-medium">{document.name}</span>
                      <span className="mt-1 block text-xs text-slate-400">{document.folderName}</span>
                      <span className="mt-1 flex flex-wrap gap-1">{document.tags.map((tag) => <Badge key={tag} variant="secondary">{tag}</Badge>)}</span>
                    </span>
                  </span>
                  <span className="text-sm text-slate-600">{document.versionLabel}</span>
                  <span className="text-sm text-slate-600">{document.uploader}</span>
                  <span className="text-sm text-slate-500">{formatWhen(document.updatedAt)}</span>
                </button>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
      {canAdminister && (
        <FolderAdmin
          folders={folders}
          people={people}
          grants={grants}
          pending={pending}
          onDone={(text) => {
            setMessage(text)
            setError('')
            router.refresh()
          }}
          onError={setError}
        />
      )}
      <Sheet open={Boolean(detail) || Boolean(detailError)} onOpenChange={(open) => { if (!open) { setDetail(null); setDetailError('') } }}>
        <SheetContent>
          <SheetHeader><SheetTitle>{detail?.name || 'Document'}</SheetTitle></SheetHeader>
          {detailError && <p className="mt-6 text-sm text-red-600">{detailError}</p>}
          {detail && (
            <div className="mt-6 flex flex-col gap-4 text-sm text-slate-600">
              <p>{detail.folderName} · {detail.versions.find((version) => version.current)?.label} · updated {formatWhen(detail.versions.find((version) => version.current)?.createdAt || '')}</p>
              <p>Uploaded by {detail.versions.find((version) => version.current)?.uploader}</p>
              <Preview version={detail.versions.find((version) => version.current) ?? null} />
              {detail.canManage && (
                <form
                  className="grid gap-2 rounded-xl border p-3"
                  onSubmit={async (event) => {
                    event.preventDefault()
                    const data = new FormData(event.currentTarget)
                    const file = data.get('file')
                    if (!(file instanceof File)) return
                    const ok = await upload(file, detail.folderId, detail.name, detail.tags.join(', '), detail.id)
                    if (ok) await openDocument(detail.id)
                  }}
                >
                  <p className="font-medium text-[#1b2a41]">Upload a new version</p>
                  <input name="file" type="file" required accept={acceptAttribute(allowedExtensions)} className="text-sm" />
                  <Button type="submit" disabled={pending} className="w-fit bg-[#1b2a41]">Save version</Button>
                </form>
              )}
              <div>
                <p className="font-medium text-[#1b2a41]">Version history</p>
                <ul className="mt-2 flex flex-col gap-2">
                  {detail.versions.map((version) => (
                    <li key={version.id} className="rounded-lg border px-3 py-2">
                      <p className="font-medium text-[#1b2a41]">{version.label}{version.current ? ' · Latest' : ''}{version.restored ? ' · Restored' : ''}</p>
                      <p>{version.fileName} · {formatSize(version.byteSize)}</p>
                      <p>{version.uploader} · {formatWhen(version.createdAt)}</p>
                      {version.signedUrl && <a className="text-[#b86f3c] underline" href={version.signedUrl}>Download</a>}
                      {detail.canManage && !version.current && (
                        <Button
                          type="button"
                          variant="outline"
                          className="mt-2"
                          disabled={pending}
                          onClick={async () => {
                            setPending(true)
                            const result = await restoreDocumentVersion(version.id)
                            setPending(false)
                            if (!result.ok) {
                              setError(result.error)
                              return
                            }
                            setMessage(result.message || messages.documentRestored)
                            await openDocument(detail.id)
                            router.refresh()
                          }}
                        >
                          Restore this version
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}

function LibraryHeading() {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#b86f3c]">Documents</p>
      <h1 className="mt-2 text-3xl font-semibold text-[#1b2a41]">Document library</h1>
    </div>
  )
}

function FolderButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={`flex items-center gap-2 rounded-lg px-3 py-2 text-left ${active ? 'bg-[#fdf0e6] font-medium text-[#b86f3c]' : 'text-slate-600 hover:bg-slate-50'}`}>
      <Folder className="size-4 shrink-0" />
      <span>{label}</span>
    </button>
  )
}

function Preview({ version }: { version: DocumentDetail['versions'][number] | null }) {
  if (!version) return <p>No file yet.</p>
  if (version.previewKind === 'markdown' && version.textPreview !== null) {
    return <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-xl bg-slate-50 p-4 text-sm text-slate-700">{version.textPreview}</pre>
  }
  if (version.previewKind === 'image' && version.signedUrl) {
    return <img src={version.signedUrl} alt={version.fileName} className="max-h-80 rounded-xl border object-contain" />
  }
  if (version.previewKind === 'pdf' && version.signedUrl) {
    return <iframe title={version.fileName} src={version.signedUrl} className="h-80 w-full rounded-xl border" />
  }
  return <p>Preview is available for PDF, images, and Markdown. Download this file to open it.</p>
}

function FolderAdmin({
  folders,
  people,
  grants,
  pending,
  onDone,
  onError,
}: {
  folders: LibraryFolder[]
  people: LibraryPerson[]
  grants: FolderGrant[]
  pending: boolean
  onDone: (message: string) => void
  onError: (message: string) => void
}) {
  const [selected, setSelected] = useState(folders[0]?.id || '')
  const folder = folders.find((item) => item.id === selected) || folders[0]
  const owners = people.filter((person) => person.roles.includes('document_owner'))
  return (
    <Card className="mt-8">
      <CardHeader><CardTitle className="text-base">Folder access</CardTitle></CardHeader>
      <CardContent className="grid gap-6">
        <form
          className="flex flex-wrap items-end gap-3"
          action={async (formData) => {
            const result = await createFolder(formData)
            if (!result.ok) onError(result.error)
            else onDone(result.message || messages.folderCreated)
          }}
        >
          <label className="text-sm">New folder
            <Input name="name" required className="mt-1" placeholder="Folder name" />
          </label>
          <label className="text-sm">Visibility
            <select name="visibility" className="mt-1 block h-9 rounded-lg border px-2" defaultValue="team">
              <option value="team">Team</option>
              <option value="restricted">Restricted</option>
            </select>
          </label>
          <Button type="submit" variant="outline">Create folder</Button>
        </form>
        {folder && (
          <form
            key={folder.id}
            className="grid gap-4"
            action={async (formData) => {
              const result = await saveFolderAccess(formData)
              if (!result.ok) onError(result.error)
              else onDone(result.message || messages.folderAccessSaved)
            }}
          >
            <label className="text-sm">Folder
              <select name="folderId" value={folder.id} onChange={(event) => setSelected(event.target.value)} className="mt-1 block h-9 w-full max-w-sm rounded-lg border px-2">
                {folders.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </label>
            <label className="text-sm">Who can view
              <select name="visibility" defaultValue={folder.visibility} className="mt-1 block h-9 w-full max-w-sm rounded-lg border px-2">
                <option value="team">Team — every member</option>
                <option value="restricted">Restricted — members only when granted below</option>
              </select>
            </label>
            <fieldset className="text-sm">
              <legend className="mb-2 font-medium">Member view grants</legend>
              <p className="mb-2 text-slate-500">Used when the folder is restricted. Other roles on the team can still view it.</p>
              <div className="grid max-h-40 gap-1 overflow-auto rounded-lg border p-3 sm:grid-cols-2">
                {people.map((person) => (
                  <label key={person.id} className="flex items-center gap-2">
                    <input type="checkbox" name="view" value={person.id} defaultChecked={grants.some((grant) => grant.folderId === folder.id && grant.userId === person.id && grant.access === 'view')} />
                    {person.fullName}
                  </label>
                ))}
              </div>
            </fieldset>
            <fieldset className="text-sm">
              <legend className="mb-2 font-medium">Document owners who can upload</legend>
              <div className="grid gap-1 rounded-lg border p-3">
                {owners.length === 0 && <p className="text-slate-500">No document owner accounts yet. Assign that role in Admin.</p>}
                {owners.map((person) => (
                  <label key={person.id} className="flex items-center gap-2">
                    <input type="checkbox" name="manage" value={person.id} defaultChecked={grants.some((grant) => grant.folderId === folder.id && grant.userId === person.id && grant.access === 'manage')} />
                    {person.fullName} · {person.roles.map(roleLabel).join(', ')}
                  </label>
                ))}
              </div>
            </fieldset>
            <Button type="submit" disabled={pending} className="w-fit bg-[#1b2a41]">Save folder access</Button>
          </form>
        )}
      </CardContent>
    </Card>
  )
}
