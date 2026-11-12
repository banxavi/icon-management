'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Bell } from 'lucide-react'
import { markAllNotificationsRead, markNotificationRead } from '@/app/actions/notifications'
import { EmptyState, PageHeader, Surface, SurfaceBody } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { messages } from '@/lib/messages'
import { cn } from '@/lib/utils'

export type Notice = {
  id: string
  title: string
  body: string
  createdAt: string
  unread: boolean
}

export function NotificationCenter({ items }: { items: Notice[] }) {
  const router = useRouter()
  const [readIds, setReadIds] = useState<string[]>([])
  const visible = items.map((item) => (readIds.includes(item.id) ? { ...item, unread: false } : item))

  async function read(id: string) {
    setReadIds((current) => (current.includes(id) ? current : [...current, id]))
    await markNotificationRead(id)
    router.refresh()
  }

  async function readAll() {
    setReadIds(visible.map((item) => item.id))
    await markAllNotificationsRead()
    router.refresh()
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Inbox"
        title="Notifications"
        description={messages.notificationHistory}
        actions={
          <Button variant="outline" onClick={() => void readAll()}>
            Mark all as read
          </Button>
        }
      />
      <Surface className="max-w-3xl">
        <SurfaceBody className="p-0">
          {visible.length === 0 ? <EmptyState title="No notifications yet." className="m-4" /> : null}
          {visible.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => void read(item.id)}
              className="flex w-full gap-4 border-b border-border/60 p-5 text-left transition-colors duration-150 ease-out hover:bg-muted/40"
            >
              <span
                className={cn(
                  'mt-1 flex size-9 shrink-0 items-center justify-center rounded-full',
                  item.unread ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground',
                )}
              >
                <Bell className="size-4" />
              </span>
              <span className="flex-1">
                <span className="flex items-center gap-2 font-medium text-foreground">
                  {item.title}
                  {item.unread ? <span className="size-2 rounded-full bg-primary" /> : null}
                </span>
                <span className="mt-1 block text-sm text-pretty text-muted-foreground">{item.body}</span>
                <span className="mt-2 block text-xs text-muted-foreground">
                  {new Date(item.createdAt).toLocaleString('en-US', { timeZone: 'Asia/Saigon' })}
                </span>
              </span>
            </button>
          ))}
        </SurfaceBody>
      </Surface>
    </div>
  )
}
