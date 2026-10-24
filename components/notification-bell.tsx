'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Bell } from 'lucide-react'
import { markNotificationRead } from '@/app/actions/notifications'
import type { Notice } from '@/components/notification-center'

export function NotificationBell({ unreadCount, notices }: { unreadCount: number; notices: Notice[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [readIds, setReadIds] = useState<string[]>([])
  const pending = readIds.filter((id) => notices.some((item) => item.id === id && item.unread))
  const unread = Math.max(0, unreadCount - pending.length)
  const label = unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'
  const unreadItems = notices.filter((item) => item.unread && !pending.includes(item.id))

  async function read(id: string) {
    setReadIds((current) => (current.includes(id) ? current : [...current, id]))
    await markNotificationRead(id)
    router.refresh()
  }

  return (
    <div className="relative">
      <button
        type="button"
        className="relative inline-flex size-8 items-center justify-center rounded-lg hover:bg-muted"
        aria-label={label}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <Bell className="size-4" />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex min-w-4 items-center justify-center rounded-full bg-[#e2894b] px-1 text-[10px] font-semibold leading-4 text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-30 mt-2 w-80 rounded-xl border border-slate-200 bg-white p-2 text-left shadow-lg">
          <p className="px-2 py-1 text-xs font-medium text-slate-500">Unread</p>
          {unreadItems.length === 0 && <p className="px-2 py-3 text-sm text-slate-500">No unread notifications.</p>}
          {unreadItems.map((item) => (
            <button key={item.id} type="button" onClick={() => void read(item.id)} className="block w-full rounded-lg px-2 py-2 text-left hover:bg-slate-50">
              <span className="block text-sm font-medium text-[#1b2a41]">{item.title}</span>
              <span className="mt-0.5 block text-xs text-slate-500">{item.body}</span>
            </button>
          ))}
          <Link href="/notifications" onClick={() => setOpen(false)} className="mt-1 block rounded-lg px-2 py-2 text-sm font-medium text-[#e2894b] hover:bg-slate-50">
            View all notifications
          </Link>
        </div>
      )}
    </div>
  )
}
