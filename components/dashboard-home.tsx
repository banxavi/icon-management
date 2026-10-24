'use client'

import Link from 'next/link'
import { ArrowRight, CheckCircle2, Clock3, Megaphone, Plus } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { DailyReportRecord } from '@/lib/types'

export type WeekDay = { date: string; label: string; submitted: boolean }
export type AssignedReport = { id: string; author: string; reportDate: string; projectName: string; blockers: string; workStatus: string }

const announcements = [
  { title: 'Reporting window', date: '2026-10-24', body: 'Daily reports can be submitted or edited until the end of the next calendar day (Asia/Saigon).' },
  { title: 'In-app notifications', date: '2026-10-24', body: 'Leaders and assigned reviewers see a notification when a daily report is submitted.' },
]

export function DashboardHome({
  todayLabel,
  report,
  week,
  canSubmit,
  isReviewer,
  isLeader,
  isAdmin,
  assigned,
}: {
  todayLabel: string
  report: DailyReportRecord | null
  week: WeekDay[]
  canSubmit: boolean
  isReviewer: boolean
  isLeader: boolean
  isAdmin: boolean
  assigned: AssignedReport[]
}) {
  const submitted = report?.status === 'submitted'
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-[#e2894b]">OVERVIEW</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Keep the day moving.</h1>
          <p className="mt-2 text-slate-500">Track your daily report and the updates meant for you.</p>
        </div>
        <Badge variant="outline" className="gap-2 bg-white px-3 py-1.5"><span className="size-2 rounded-full bg-emerald-500" />Portal online</Badge>
      </div>
      {canSubmit && (
        <Card className="border-0 shadow-sm">
          <CardContent className="grid gap-6 p-6 md:grid-cols-[1fr_auto] md:items-center">
            <div>
              <div className="flex items-center gap-2 text-sm font-medium text-slate-500"><Clock3 className="size-4" />Today · {todayLabel}</div>
              <h2 className="mt-3 text-2xl font-semibold">Your daily report</h2>
              <p className="mt-2 text-slate-500">{submitted ? 'Submitted. You can still edit it until the window closes.' : 'You have not submitted today. It takes about two minutes.'}</p>
              {submitted && report?.submittedAt && <p className="mt-2 text-sm text-emerald-700">Submitted · {new Date(report.submittedAt).toLocaleString('en-US', { timeZone: 'Asia/Saigon' })}</p>}
              <Link href="/reports/daily/new" className={cn(buttonVariants(), 'mt-5 gap-2 bg-[#1b2a41] hover:bg-[#263b59]')}>
                <Plus className="size-4" />
                {submitted ? 'Edit daily report' : 'Submit daily report'}
              </Link>
            </div>
            <div className="flex size-28 flex-col items-center justify-center rounded-full border-[10px] border-[#f0a060]/25 text-center">
              <span className="text-sm font-bold">{submitted ? 'Submitted' : 'Not submitted'}</span>
            </div>
          </CardContent>
        </Card>
      )}
      {isLeader && <p className="text-sm"><Link href="/team/dashboard" className="font-medium text-[#e2894b]">Open the team dashboard</Link> to see who has submitted.</p>}
      {isAdmin && <p className="text-sm"><Link href="/admin" className="font-medium text-[#e2894b]">Open admin</Link> to import or deactivate accounts.</p>}
      {isReviewer && (
        <Card className="border-0 shadow-sm">
          <CardHeader><CardTitle className="text-base">Assigned reports</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-sm text-slate-500">Read only. You see reports for members assigned to you.</p>
            {assigned.length === 0 && <p className="text-sm text-slate-500">No submitted reports yet.</p>}
            {assigned.map((item) => (
              <div key={item.id} className={`rounded-xl border p-4 text-sm ${item.blockers || item.workStatus === 'wfh' ? 'border-orange-200 bg-orange-50/60' : 'border-slate-100'}`}>
                <p className="font-medium">{item.author}</p>
                <p className="text-slate-500">{item.reportDate} · {item.projectName} · {item.workStatus === 'wfh' ? 'WFH' : 'Office'}</p>
                {item.blockers && <p className="mt-1 text-amber-700">Blocker: {item.blockers}</p>}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
      <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
        <Card className="border-0 shadow-sm">
          <CardHeader><CardTitle className="text-base">This week</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-4">
            {week.map((day) => (
              <div key={day.date} className="flex items-center gap-3">
                <div className={`flex size-7 items-center justify-center rounded-full ${day.submitted ? 'bg-emerald-50 text-emerald-600' : 'bg-orange-50 text-[#e2894b]'}`}>
                  {day.submitted ? <CheckCircle2 className="size-4" /> : <Clock3 className="size-4" />}
                </div>
                <span className="flex-1 text-sm">{day.label}</span>
                <span className="text-xs text-slate-400">{day.submitted ? 'Submitted' : 'Not submitted'}</span>
              </div>
            ))}
            <Link href="/reports/history" className="mt-2 flex items-center gap-1 text-sm font-medium text-[#e2894b]">View sample history <ArrowRight className="size-4" /></Link>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Megaphone className="size-4 text-[#e2894b]" />Latest notes</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-4">
            {announcements.map((item) => (
              <div key={item.title} className="border-b border-slate-100 pb-4 last:border-0 last:pb-0">
                <p className="font-medium">{item.title}</p>
                <p className="mt-1 text-sm leading-6 text-slate-500">{item.body}</p>
                <p className="mt-2 text-xs text-slate-400">{item.date}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
