import { requireSession } from '@/lib/auth/session'
import { loadShell } from '@/lib/data/load'
import { PortalProvider } from '@/components/portal-provider'
import { PortalShell } from '@/components/portal-shell'

export const dynamic = 'force-dynamic'

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession()
  const shell = await loadShell(session)
  return (
    <PortalProvider session={session}>
      <PortalShell unreadCount={shell.unreadCount} weekSubmitted={shell.weekSubmitted} notices={shell.notices}>
        {children}
      </PortalShell>
    </PortalProvider>
  )
}
