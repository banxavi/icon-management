'use client'

import { useState } from 'react'
import { Pin, Plus } from 'lucide-react'
import { useSession } from '@/components/portal-provider'
import { MockBanner } from '@/components/mock-banner'
import { PageHeader, Surface, SurfaceBody } from '@/components/layout'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { announcements } from '@/lib/mock-data'

export function AnnouncementsScreen() {
  const session = useSession()
  const canPost = session.roles.includes('team_leader')
  const [list, setList] = useState(announcements)
  return (
    <div className="flex flex-col gap-6">
      <MockBanner />
      <PageHeader
        eyebrow="Announcements"
        title="Team announcements"
        description="Sample posts. They are not saved."
        actions={
          canPost ? (
            <Button
              type="button"
              onClick={() =>
                setList([
                  { title: 'New team note', date: '2026-10-24', body: 'This preview item is only on your screen.', pinned: true },
                  ...list,
                ])
              }
            >
              <Plus className="size-4" />
              Post preview
            </Button>
          ) : null
        }
      />
      <div className="grid max-w-3xl gap-4">
        {list.map((item, index) => (
          <Surface key={`${item.title}-${index}`}>
            <SurfaceBody>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {item.pinned ? (
                  <Badge variant="secondary">
                    <Pin className="mr-1 size-3" />
                    Pinned
                  </Badge>
                ) : null}
                {item.date}
              </div>
              <h2 className="mt-3 font-display font-semibold text-balance">{item.title}</h2>
              <p className="mt-2 text-sm text-pretty text-muted-foreground">{item.body}</p>
            </SurfaceBody>
          </Surface>
        ))}
      </div>
    </div>
  )
}
