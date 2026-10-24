'use client'

import { useState } from 'react'
import { Pin, Plus } from 'lucide-react'
import { useSession } from '@/components/portal-provider'
import { MockBanner } from '@/components/mock-banner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { announcements } from '@/lib/mock-data'

export function AnnouncementsScreen() {
  const session = useSession()
  const canPost = session.roles.includes('team_leader')
  const [list, setList] = useState(announcements)
  return (
    <div>
      <MockBanner />
      <div className="mb-6 mt-6 flex items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#b86f3c]">Announcements</p>
          <h1 className="mt-2 text-3xl font-semibold text-[#1b2a41]">Team announcements</h1>
          <p className="mt-2 text-sm text-slate-500">Sample posts. They are not saved.</p>
        </div>
        {canPost && (
          <Button type="button" className="bg-[#1b2a41]" onClick={() => setList([{ title: 'New team note', date: '2026-10-24', body: 'This preview item is only on your screen.', pinned: true }, ...list])}>
            <Plus className="size-4" />Post preview
          </Button>
        )}
      </div>
      <div className="grid max-w-3xl gap-4">
        {list.map((item, index) => (
          <Card key={`${item.title}-${index}`}>
            <CardContent className="p-5">
              <div className="flex items-center gap-2 text-xs text-slate-400">
                {item.pinned && <Badge variant="secondary"><Pin className="mr-1 size-3" />Pinned</Badge>}
                {item.date}
              </div>
              <h2 className="mt-3 font-semibold">{item.title}</h2>
              <p className="mt-2 text-sm text-slate-600">{item.body}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
