import { requireSession } from '@/lib/auth/session'
import { loadDirectory } from '@/lib/data/load'
import { DirectoryPanel } from '@/components/directory-panel'

export const dynamic = 'force-dynamic'

export default async function DirectoryPage() {
  const session = await requireSession()
  const people = await loadDirectory(session)
  return <DirectoryPanel people={people} />
}
