'use client'

import { Bell } from 'lucide-react'
import { markAllNotificationsRead, markNotificationRead } from '@/app/actions/notifications'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

export type Notice = {
  id: string
  title: string
  body: string
  createdAt: string
  unread: boolean
}

export function NotificationCenter({ items }: { items: Notice[] }) {
  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#b86f3c]">Inbox</p>
          <h1 className="mt-2 text-3xl font-semibold text-[#1b2a41]">Notifications</h1>
          <p className="mt-2 text-sm text-slate-500">In-app updates for reports and WFH declarations.</p>
        </div>
        <Button variant="outline" onClick={() => markAllNotificationsRead()}>Mark all as read</Button>
      </div>
      <Card className="max-w-3xl">
        <CardContent className="p-0">
          {items.length === 0 && <p className="p-6 text-sm text-slate-500">No notifications yet.</p>}
          {items.map((item) => (
            <button key={item.id} type="button" onClick={() => markNotificationRead(item.id)} className="flex w-full gap-4 border-b p-5 text-left hover:bg-slate-50">
              <span className={`mt-1 flex size-9 shrink-0 items-center justify-center rounded-full ${item.unread ? 'bg-[#fdf0e6] text-[#b86f3c]' : 'bg-slate-100 text-slate-400'}`}><Bell className="size-4" /></span>
              <span className="flex-1">
                <span className="flex items-center gap-2 font-medium text-[#1b2a41]">{item.title}{item.unread && <span className="size-2 rounded-full bg-[#b86f3c]" />}</span>
                <span className="mt-1 block text-sm text-slate-500">{item.body}</span>
                <span className="mt-2 block text-xs text-slate-400">{new Date(item.createdAt).toLocaleString('en-US', { timeZone: 'Asia/Saigon' })}</span>
              </span>
            </button>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
