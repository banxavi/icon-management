export const DOCUMENT_EXTENSIONS = ['pdf', 'docx', 'xlsx', 'pptx', 'md', 'png', 'jpg'] as const

export type DocumentExtension = (typeof DOCUMENT_EXTENSIONS)[number]

export const DEFAULT_MAX_UPLOAD_MB = 50

export type PreviewKind = 'pdf' | 'image' | 'markdown' | 'none'

export function fileExtension(fileName: string): string {
  const base = fileName.trim().toLowerCase()
  const dot = base.lastIndexOf('.')
  if (dot <= 0 || dot === base.length - 1) return ''
  const extension = base.slice(dot + 1)
  return extension === 'jpeg' ? 'jpg' : extension
}

export function previewKind(fileName: string): PreviewKind {
  const extension = fileExtension(fileName)
  if (extension === 'pdf') return 'pdf'
  if (extension === 'png' || extension === 'jpg') return 'image'
  if (extension === 'md') return 'markdown'
  return 'none'
}

export function validateUpload(input: {
  fileName: string
  byteSize: number
  allowedExtensions: string[]
  maxUploadMb: number
}): { ok: true; extension: string } | { ok: false; code: 'FILE_TYPE' | 'FILE_TOO_LARGE' | 'FILE_EMPTY' } {
  const extension = fileExtension(input.fileName)
  const allowed = new Set(input.allowedExtensions.map((item) => item.toLowerCase()))
  if (!extension || !allowed.has(extension)) return { ok: false, code: 'FILE_TYPE' }
  if (!Number.isFinite(input.byteSize) || input.byteSize <= 0) return { ok: false, code: 'FILE_EMPTY' }
  if (input.byteSize > input.maxUploadMb * 1024 * 1024) return { ok: false, code: 'FILE_TOO_LARGE' }
  return { ok: true, extension }
}

export function parseTags(value: string): { ok: true; tags: string[] } | { ok: false; error: string } {
  const tags = value.split(',').map((tag) => tag.trim()).filter(Boolean)
  if (tags.length > 8) return { ok: false, error: 'Use at most 8 tags.' }
  if (tags.some((tag) => tag.length > 40)) return { ok: false, error: 'Each tag must be 40 characters or fewer.' }
  return { ok: true, tags }
}

export function validateDocumentName(name: string): string | null {
  const trimmed = name.trim()
  if (trimmed.length < 2 || trimmed.length > 160) return 'Enter a document name between 2 and 160 characters.'
  return null
}

export function versionLabel(versionNumber: number): string {
  return `v${versionNumber}`
}

/** Object key segment. The database uses the same cleanup when it builds the storage path. */
export function safeStorageName(fileName: string): string {
  const cleaned = fileName.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '')
  const sliced = cleaned.slice(-120)
  return sliced || 'file'
}

export function acceptAttribute(extensions: string[]): string {
  const list = extensions.flatMap((extension) => (extension === 'jpg' ? ['.jpg', '.jpeg'] : [`.${extension}`]))
  return list.join(',')
}
