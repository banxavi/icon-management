import { requireSession } from '@/lib/auth/session'
import { loadNotifications } from '@/lib/data/load'
import { NotificationCenter } from '@/components/notification-center'

export const dynamic = 'force-dynamic'

export default async function NotificationsPage() {
  const session = await requireSession()
  const items = await loadNotifications(session)
  return <NotificationCenter items={items} />
}
