'use client'

import { useState } from 'react'
import { AlertTriangle, CheckCircle2, Home } from 'lucide-react'
import { loadTeamBoard } from '@/app/actions/reports'
import { PageHeader, StatusPill, Surface, SurfaceBody, SurfaceHeader } from '@/components/layout'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import type { DailyReportRecord } from '@/lib/types'
import { cn } from '@/lib/utils'

export type TeamRow = {
  id: string
  name: string
  email: string
  projects: string[]
  status: 'submitted' | 'not_submitted' | 'late'
  report: DailyReportRecord | null
}

const statusLabel = {
  submitted: 'Submitted',
  not_submitted: 'Not submitted',
  late: 'Late',
} as const

const statusTone = {
  submitted: 'success',
  not_submitted: 'neutral',
  late: 'warning',
} as const

export function TeamDashboard({
  initialDate,
  initialRows,
  projects,
}: {
  initialDate: string
  initialRows: TeamRow[]
  projects: { id: string; name: string }[]
}) {
  const [date, setDate] = useState(initialDate)
  const [rows, setRows] = useState(initialRows)
  const [project, setProject] = useState('all')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<TeamRow | null>(null)

  async function changeDate(value: string) {
    setDate(value)
    const result = await loadTeamBoard(value)
    if (!result.forbidden) setRows(result.rows)
  }

  const visible = rows.filter((row) => {
    const matchesQuery = `${row.name} ${row.email}`.toLowerCase().includes(query.toLowerCase())
    const projectName = row.report?.projectName || row.projects[0] || ''
    const matchesProject = project === 'all' || projectName === project || row.projects.includes(project)
    return matchesQuery && matchesProject
  })
  const submitted = visible.filter((row) => row.status === 'submitted' || row.status === 'late').length
  const wfh = visible.filter((row) => row.report?.workStatus === 'wfh').length
  const blocked = visible.filter((row) => row.report?.blockers).length

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Team leader"
        title="Team report dashboard"
        description="Submitted, not submitted, and late. Blockers and WFH are highlighted. Leave is not tracked in this release."
      />
      <div className="grid gap-4 md:grid-cols-3">
        <Stat label="Submitted" value={`${submitted}/${visible.length}`} icon={CheckCircle2} />
        <Stat label="WFH today" value={String(wfh)} icon={Home} />
        <Stat label="With blockers" value={String(blocked)} icon={AlertTriangle} />
      </div>
      <Surface>
        <SurfaceHeader
          title="Member status"
          actions={<Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search members..." className="w-52" aria-label="Search members" />}
        />
        <SurfaceBody>
          <div className="mb-4 flex flex-wrap gap-2">
            <Input type="date" value={date} onChange={(event) => void changeDate(event.target.value)} className="w-44" aria-label="Report date" />
            <select value={project} onChange={(event) => setProject(event.target.value)} className="h-9 rounded-lg border border-input bg-background px-2 text-sm" aria-label="Project">
              <option value="all">All projects</option>
              {projects.map((item) => (
                <option key={item.id} value={item.name}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-3">Member</th>
                  <th className="px-3 py-3">Project</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3">Work</th>
                  <th className="px-3 py-3">Note</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((row) => {
                  const highlight = Boolean(row.report?.blockers) || row.report?.workStatus === 'wfh'
                  return (
                    <tr
                      key={row.id}
                      onClick={() => setSelected(row)}
                      className={cn(
                        'cursor-pointer border-b border-border/60 last:border-0 hover:bg-muted/40',
                        highlight && 'bg-amber-50/70',
                      )}
                    >
                      <td className="px-3 py-3 font-medium">{row.name}</td>
                      <td className="px-3 py-3 text-muted-foreground">{row.report?.projectName || row.projects.join(', ') || '—'}</td>
                      <td className="px-3 py-3">
                        <StatusPill tone={statusTone[row.status]}>
                          {statusLabel[row.status]}
                          {row.report?.edited ? ' · Edited' : ''}
                        </StatusPill>
                      </td>
                      <td className="px-3 py-3">
                        <Badge variant="secondary">{row.report?.workStatus === 'wfh' ? 'WFH' : row.report ? 'Office' : '—'}</Badge>
                      </td>
                      <td className="px-3 py-3 text-amber-800">{row.report?.blockers || ''}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </SurfaceBody>
      </Surface>
      <Sheet open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Report detail</SheetTitle>
          </SheetHeader>
          {selected ? (
            <div className="flex flex-col gap-5 p-4 text-sm">
              <div>
                <p className="font-display text-xl font-semibold">{selected.name}</p>
                <p className="text-muted-foreground">
                  {selected.report?.projectName || 'No project'} · {date}
                </p>
              </div>
              <StatusPill tone={statusTone[selected.status]}>{statusLabel[selected.status]}</StatusPill>
              {selected.report?.edited ? <Badge variant="secondary">Edited</Badge> : null}
              {selected.report ? (
                <>
                  <Detail label="Done today" value={selected.report.doneToday} />
                  <Detail label="Next plan" value={selected.report.nextPlan} />
                  <Detail label="Blockers" value={selected.report.blockers || 'None'} />
                  {selected.report.workStatus === 'wfh' ? <Detail label="WFH reason" value={selected.report.wfhReason} /> : null}
                  {selected.report.submittedAt ? (
                    <p className="text-xs text-muted-foreground">
                      Submitted {new Date(selected.report.submittedAt).toLocaleString('en-US', { timeZone: 'Asia/Saigon' })}
                    </p>
                  ) : null}
                </>
              ) : (
                <p className="text-muted-foreground">No report for this date.</p>
              )}
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  )
}

function Stat({ label, value, icon: Icon }: { label: string; value: string; icon: typeof CheckCircle2 }) {
  return (
    <Surface>
      <SurfaceBody className="flex items-center gap-4">
        <div className="rounded-xl bg-primary/10 p-3 text-primary">
          <Icon className="size-5" />
        </div>
        <div>
          <p className="font-display text-2xl font-semibold tabular-nums">{value}</p>
          <p className="text-sm text-muted-foreground">{label}</p>
        </div>
      </SurfaceBody>
    </Surface>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-sm font-medium">{label}</p>
      <p className="mt-1 whitespace-pre-wrap text-pretty text-muted-foreground">{value}</p>
    </div>
  )
}
