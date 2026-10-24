'use client'

import { useState } from 'react'
import Link from 'next/link'
import { CalendarDays, ChevronRight, Search } from 'lucide-react'
import { MockBanner } from '@/components/mock-banner'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-[#e2894b]">REPORTS</p>
          <h1 className="mt-1 text-3xl font-semibold">Report history</h1>
          <p className="mt-2 text-slate-500">Sample history only. Search across saved reports is not connected.</p>
        </div>
        <Link href="/reports/daily/new" className={cn(buttonVariants(), 'bg-[#1b2a41] hover:bg-[#263b59]')}>New daily report</Link>
      </div>
      <Card className="border-0 shadow-sm">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-4">
          <CardTitle className="text-base">Daily reports <span className="ml-2 text-sm font-normal text-slate-400">{filtered.length} sample rows</span></CardTitle>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 size-4 text-slate-400" />
            <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search date or project..." className="w-56 pl-9" />
          </div>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-xs text-slate-400">Sample projects: {projects.join(', ')}</p>
          <table className="w-full text-left text-sm">
            <thead className="border-b text-xs uppercase text-slate-400"><tr><th className="px-3 py-3">Date</th><th className="px-3 py-3">Project</th><th className="px-3 py-3">Summary</th><th className="px-3 py-3">Status</th><th /></tr></thead>
            <tbody>
              {filtered.map((report) => (
                <tr key={report.id} className="cursor-pointer border-b hover:bg-slate-50" onClick={() => setSelected(report)}>
                  <td className="px-3 py-4"><span className="flex items-center gap-2 font-medium"><CalendarDays className="size-4 text-slate-400" />{report.date}</span></td>
                  <td className="px-3 py-4">{report.project}</td>
                  <td className="max-w-xs truncate px-3 py-4 text-slate-500">{report.summary}</td>
                  <td className="px-3 py-4"><Badge variant="secondary">{report.status}</Badge></td>
                  <td className="px-3 py-4 text-right"><ChevronRight className="ml-auto size-4 text-slate-400" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
      <Sheet open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Daily report detail</SheetTitle>
            <SheetDescription>{selected?.date} · {selected?.project}</SheetDescription>
          </SheetHeader>
          {selected && <p className="p-4 text-sm leading-7 text-slate-600">{selected.summary}</p>}
        </SheetContent>
      </Sheet>
    </div>
  )
}
