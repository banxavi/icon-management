import { describe, expect, it } from 'vitest'
import { fileExtension, parseTags, previewKind, safeStorageName, validateDocumentName, validateUpload, versionLabel } from '@/lib/documents/rules'

const allowed = ['pdf', 'docx', 'xlsx', 'pptx', 'md', 'png', 'jpg']

describe('document upload rules', () => {
  it('accepts the configured types and treats jpeg as jpg', () => {
    expect(fileExtension('Notes.PDF')).toBe('pdf')
    expect(fileExtension('photo.JPEG')).toBe('jpg')
    expect(validateUpload({ fileName: 'photo.JPEG', byteSize: 1200, allowedExtensions: allowed, maxUploadMb: 50 })).toEqual({
      ok: true,
      extension: 'jpg',
    })
    expect(validateUpload({ fileName: 'script.exe', byteSize: 1200, allowedExtensions: allowed, maxUploadMb: 50 })).toEqual({
      ok: false,
      code: 'FILE_TYPE',
    })
  })

  it('rejects empty files and files over the configured megabyte limit', () => {
    expect(validateUpload({ fileName: 'a.pdf', byteSize: 0, allowedExtensions: allowed, maxUploadMb: 50 }).ok).toBe(false)
    expect(validateUpload({ fileName: 'a.pdf', byteSize: 50 * 1024 * 1024 + 1, allowedExtensions: allowed, maxUploadMb: 50 })).toEqual({
      ok: false,
      code: 'FILE_TOO_LARGE',
    })
    expect(validateUpload({ fileName: 'a.pdf', byteSize: 2 * 1024 * 1024, allowedExtensions: ['pdf'], maxUploadMb: 2 }).ok).toBe(true)
  })

  it('limits tags and names and labels versions', () => {
    expect(parseTags(' WFH, Reports ')).toEqual({ ok: true, tags: ['WFH', 'Reports'] })
    expect(parseTags('a,b,c,d,e,f,g,h,i').ok).toBe(false)
    expect(validateDocumentName(' A ')).toBeTruthy()
    expect(validateDocumentName('WFH policy')).toBeNull()
    expect(versionLabel(3)).toBe('v3')
    expect(previewKind('guide.md')).toBe('markdown')
    expect(previewKind('slide.pptx')).toBe('none')
    expect(safeStorageName('My File (1).pdf')).toBe('my-file-1-.pdf')
  })
})
