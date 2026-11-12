'use client'

import Link from 'next/link'
import { ArrowRight, CheckCircle2, Clock3, Megaphone, Plus } from 'lucide-react'
import { EmptyState, PageHeader, StatusPill, Surface, SurfaceBody, SurfaceHeader } from '@/components/layout'
import { buttonVariants } from '@/components/ui/button'
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
      <PageHeader
        eyebrow="Overview"
        title="Keep the day moving."
        description="Track your daily report and the updates meant for you."
        actions={<StatusPill tone="success" dot>Portal online</StatusPill>}
      />
      {canSubmit ? (
        <Surface className="overflow-hidden">
          <SurfaceBody className="grid gap-6 md:grid-cols-[1fr_auto] md:items-center">
            <div>
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Clock3 className="size-4" />
                Today · {todayLabel}
              </div>
              <h2 className="mt-3 font-display text-2xl font-semibold text-balance">Your daily report</h2>
              <p className="mt-2 text-sm text-pretty text-muted-foreground">
                {submitted ? 'Submitted. You can still edit it until the window closes.' : 'You have not submitted today. It takes about two minutes.'}
              </p>
              {submitted && report?.submittedAt ? (
                <p className="mt-2 text-sm text-emerald-700">
                  Submitted · {new Date(report.submittedAt).toLocaleString('en-US', { timeZone: 'Asia/Saigon' })}
                </p>
              ) : null}
              <Link href="/reports/daily/new" className={cn(buttonVariants({ size: 'lg' }), 'mt-5 gap-2')}>
                <Plus className="size-4" />
                {submitted ? 'Edit daily report' : 'Submit daily report'}
              </Link>
            </div>
            <div
              className={cn(
                'flex size-28 flex-col items-center justify-center rounded-full border-[10px] text-center',
                submitted ? 'border-emerald-200 text-emerald-700' : 'border-primary/25 text-primary',
              )}
            >
              <span className="text-sm font-bold">{submitted ? 'Submitted' : 'Not submitted'}</span>
            </div>
          </SurfaceBody>
        </Surface>
      ) : null}
      {isLeader ? (
        <p className="text-sm text-pretty">
          <Link href="/team/dashboard" className="font-medium text-primary hover:underline">
            Open the team dashboard
          </Link>{' '}
          to see who has submitted.
        </p>
      ) : null}
      {isAdmin ? (
        <p className="text-sm text-pretty">
          <Link href="/admin" className="font-medium text-primary hover:underline">
            Open admin
          </Link>{' '}
          to import or deactivate accounts.
        </p>
      ) : null}
      {isReviewer ? (
        <Surface>
          <SurfaceHeader title="Assigned reports" description="Read only. You see reports for members assigned to you." />
          <SurfaceBody className="flex flex-col gap-3">
            {assigned.length === 0 ? <EmptyState title="No submitted reports yet." className="border-0 bg-transparent px-0 py-4" /> : null}
            {assigned.map((item) => (
              <div
                key={item.id}
                className={cn(
                  'rounded-xl border p-4 text-sm',
                  item.blockers || item.workStatus === 'wfh' ? 'border-amber-200 bg-amber-50/60' : 'border-border/70',
                )}
              >
                <p className="font-medium">{item.author}</p>
                <p className="text-muted-foreground">
                  {item.reportDate} · {item.projectName} · {item.workStatus === 'wfh' ? 'WFH' : 'Office'}
                </p>
                {item.blockers ? <p className="mt-1 text-amber-800">Blocker: {item.blockers}</p> : null}
              </div>
            ))}
          </SurfaceBody>
        </Surface>
      ) : null}
      <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
        <Surface>
          <SurfaceHeader title="This week" />
          <SurfaceBody className="flex flex-col gap-4">
            {week.map((day) => (
              <div key={day.date} className="flex items-center gap-3">
                <div
                  className={cn(
                    'flex size-7 items-center justify-center rounded-full',
                    day.submitted ? 'bg-emerald-50 text-emerald-600' : 'bg-primary/10 text-primary',
                  )}
                >
                  {day.submitted ? <CheckCircle2 className="size-4" /> : <Clock3 className="size-4" />}
                </div>
                <span className="flex-1 text-sm">{day.label}</span>
                <span className="text-xs text-muted-foreground">{day.submitted ? 'Submitted' : 'Not submitted'}</span>
              </div>
            ))}
            <Link href="/reports/history" className="mt-2 flex items-center gap-1 text-sm font-medium text-primary hover:underline">
              View sample history <ArrowRight className="size-4" />
            </Link>
          </SurfaceBody>
        </Surface>
        <Surface>
          <SurfaceHeader
            title={
              <span className="inline-flex items-center gap-2">
                <Megaphone className="size-4 text-primary" />
                Latest notes
              </span>
            }
          />
          <SurfaceBody className="flex flex-col gap-4">
            {announcements.map((item) => (
              <div key={item.title} className="border-b border-border/60 pb-4 last:border-0 last:pb-0">
                <p className="font-medium">{item.title}</p>
                <p className="mt-1 text-sm leading-6 text-pretty text-muted-foreground">{item.body}</p>
                <p className="mt-2 text-xs text-muted-foreground">{item.date}</p>
              </div>
            ))}
          </SurfaceBody>
        </Surface>
      </div>
    </div>
  )
}
