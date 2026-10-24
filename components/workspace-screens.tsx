'use client'

import { useState } from 'react'
import { FileText, Folder, Pin, Plus, Search } from 'lucide-react'
import { useSession } from '@/components/portal-provider'
import { MockBanner } from '@/components/mock-banner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { announcements, documents } from '@/lib/mock-data'
import { messages } from '@/lib/messages'

export function DocumentsScreen() {
  const session = useSession()
  const canUpload = session.roles.some((role) => role === 'document_owner' || role === 'team_leader' || role === 'admin')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<(typeof documents)[number] | null>(null)
  const filtered = documents.filter((doc) => `${doc.name} ${doc.tags.join(' ')}`.toLowerCase().includes(query.toLowerCase()))
  return (
    <>
      <MockBanner />
      <div className="mb-6 mt-6">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#b86f3c]">Documents</p>
        <h1 className="mt-2 text-3xl font-semibold text-[#1b2a41]">Document library</h1>
        <p className="mt-2 text-sm text-slate-500">Sample folders and files. Upload is not connected.</p>
      </div>
      <div className="flex flex-col gap-6 lg:flex-row">
        <Card className="h-fit lg:w-60">
          <CardHeader><CardTitle className="text-sm">Folders</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-1 text-sm">
            {['All documents', 'Policies', 'Process', 'Guides', 'Projects'].map((folder) => (
              <p key={folder} className="flex items-center gap-2 rounded-lg px-3 py-2 text-slate-600"><Folder className="size-4" />{folder}</p>
            ))}
          </CardContent>
        </Card>
        <div className="min-w-0 flex-1">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 size-4 text-slate-400" />
              <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by name or tag..." className="bg-white pl-9" />
            </div>
            {canUpload && <Button type="button" className="bg-[#1b2a41]" onClick={() => window.alert(messages.previewOnly)}>Upload</Button>}
          </div>
          <Card>
            <CardContent className="p-0">
              {filtered.map((doc) => (
                <button key={doc.id} type="button" onClick={() => setSelected(doc)} className="grid w-full grid-cols-1 gap-2 border-b px-5 py-4 text-left hover:bg-slate-50 md:grid-cols-[1fr_110px_160px_120px] md:items-center">
                  <span className="flex items-start gap-3">
                    <FileText className="mt-0.5 size-4" />
                    <span>
                      <span className="block font-medium">{doc.name}</span>
                      <span className="mt-1 flex flex-wrap gap-1">{doc.tags.map((tag) => <Badge key={tag} variant="secondary">{tag}</Badge>)}</span>
                    </span>
                  </span>
                  <span className="text-sm text-slate-600">{doc.version}</span>
                  <span className="text-sm text-slate-600">{doc.uploader}</span>
                  <span className="text-sm text-slate-500">{doc.updated}</span>
                </button>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
      <Sheet open={!!selected} onOpenChange={() => setSelected(null)}>
        <SheetContent>
          <SheetHeader><SheetTitle>{selected?.name}</SheetTitle></SheetHeader>
          <div className="mt-6 flex flex-col gap-4 text-sm text-slate-600">
            <div className="flex h-40 items-center justify-center rounded-xl bg-slate-100">Preview placeholder · {selected?.kind}</div>
            <p>{selected?.version} · updated {selected?.updated} by {selected?.uploader}</p>
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}

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
