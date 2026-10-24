import { DocumentsLibrary } from '@/components/documents-library'
import { requireSession } from '@/lib/auth/session'
import { loadDocumentLibrary } from '@/lib/data/documents'

export const dynamic = 'force-dynamic'

export default async function DocumentsPage() {
  const session = await requireSession()
  const data = await loadDocumentLibrary(session)
  return (
    <DocumentsLibrary
      configured={data.configured}
      loadError={data.loadError}
      folders={data.folders}
      documents={data.documents}
      people={data.people}
      grants={data.grants}
      canAdminister={data.canAdminister}
      maxUploadMb={data.maxUploadMb}
      allowedExtensions={data.allowedExtensions}
    />
  )
}
