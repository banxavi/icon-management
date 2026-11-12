'use client'

import { useState } from 'react'
import Link from 'next/link'
import { CalendarDays, ChevronRight, Search } from 'lucide-react'
import { MockBanner } from '@/components/mock-banner'
import { PageHeader, Surface, SurfaceBody, SurfaceHeader } from '@/components/layout'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { dailyReports, projects } from '@/lib/mock-data'
import { cn } from '@/lib/utils'

export default function HistoryPage() {
  const [selected, setSelected] = useState<(typeof dailyReports)[number] | null>(null)
  const [query, setQuery] = useState('')
  const filtered = dailyReports.filter((report) => report.project.toLowerCase().includes(query.toLowerCase()) || report.date.includes(query))
  return (
    <div className="flex flex-col gap-6">
      <MockBanner />
      <PageHeader
        eyebrow="Reports"
        title="Report history"
        description="Sample history only. Search across saved reports is not connected."
        actions={<Link href="/reports/daily/new" className={cn(buttonVariants())}>New daily report</Link>}
      />
      <Surface>
        <SurfaceHeader
          title={<>Daily reports <span className="ml-2 text-sm font-normal text-muted-foreground">{filtered.length} sample rows</span></>}
          actions={
            <div className="relative">
              <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
              <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search date or project..." className="w-56 pl-9" aria-label="Search reports" />
            </div>
          }
        />
        <SurfaceBody>
          <p className="mb-3 text-xs text-muted-foreground">Sample projects: {projects.join(', ')}</p>
          <table className="w-full text-left text-sm">
            <thead className="border-b text-xs uppercase text-muted-foreground"><tr><th className="px-3 py-3">Date</th><th className="px-3 py-3">Project</th><th className="px-3 py-3">Summary</th><th className="px-3 py-3">Status</th><th /></tr></thead>
            <tbody>
              {filtered.map((report) => (
                <tr key={report.id} className="cursor-pointer border-b hover:bg-muted/40" onClick={() => setSelected(report)}>
                  <td className="px-3 py-4"><span className="flex items-center gap-2 font-medium"><CalendarDays className="size-4 text-muted-foreground" />{report.date}</span></td>
                  <td className="px-3 py-4">{report.project}</td>
                  <td className="max-w-xs truncate px-3 py-4 text-muted-foreground">{report.summary}</td>
                  <td className="px-3 py-4"><Badge variant="secondary">{report.status}</Badge></td>
                  <td className="px-3 py-4 text-right"><ChevronRight className="ml-auto size-4 text-muted-foreground" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </SurfaceBody>
      </Surface>
      <Sheet open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Daily report detail</SheetTitle>
            <SheetDescription>{selected?.date} · {selected?.project}</SheetDescription>
          </SheetHeader>
          {selected && <p className="p-4 text-sm leading-7 text-muted-foreground">{selected.summary}</p>}
        </SheetContent>
      </Sheet>
    </div>
  )
}
