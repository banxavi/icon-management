'use client'

import { useEffect, useState } from 'react'
import { Check, Info } from 'lucide-react'
import { toast } from 'sonner'
import { loadOwnReport, saveDailyReport } from '@/app/actions/reports'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { messages } from '@/lib/messages'
import type { DailyReportRecord, ProjectOption } from '@/lib/types'

type Props = {
  projects: ProjectOption[]
  initialDate: string
  minDate: string
  maxDate: string
  initialReport: DailyReportRecord | null
}

export function DailyReportForm({ projects, initialDate, minDate, maxDate, initialReport }: Props) {
  const [reportDate, setReportDate] = useState(initialDate)
  const [projectId, setProjectId] = useState(initialReport?.projectId || projects[0]?.id || '')
  const [workStatus, setWorkStatus] = useState<'office' | 'wfh'>(initialReport?.workStatus || 'office')
  const [wfhReason, setWfhReason] = useState(initialReport?.wfhReason || '')
  const [doneToday, setDoneToday] = useState(initialReport?.doneToday || '')
  const [nextPlan, setNextPlan] = useState(initialReport?.nextPlan || '')
  const [blockers, setBlockers] = useState(initialReport?.blockers || '')
  const [status, setStatus] = useState(initialReport?.status || 'draft')
  const [submittedAt, setSubmittedAt] = useState(initialReport?.submittedAt || null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  function applyReport(report: DailyReportRecord | null) {
    setProjectId(report?.projectId || projects[0]?.id || '')
    setWorkStatus(report?.workStatus || 'office')
    setWfhReason(report?.wfhReason || '')
    setDoneToday(report?.doneToday || '')
    setNextPlan(report?.nextPlan || '')
    setBlockers(report?.blockers || '')
    setStatus(report?.status || 'draft')
    setSubmittedAt(report?.submittedAt || null)
  }

  async function onDateChange(value: string) {
    setReportDate(value)
    setErrors({})
    const report = await loadOwnReport(value)
    applyReport(report)
  }

  async function persist(intent: 'draft' | 'submit') {
    setPending(true)
    const result = await saveDailyReport({
      reportDate,
      projectId,
      workStatus,
      wfhReason,
      doneToday,
      nextPlan,
      blockers,
      intent,
    })
    setPending(false)
    if (!result.ok) {
      setErrors(result.fieldErrors ?? {})
      toast.error(result.error || messages.saveFailed)
      if (result.report) applyReport(result.report)
      return
    }
    setErrors({})
    if (result.report) applyReport(result.report)
    setSavedAt(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }))
    if (intent === 'submit') toast.success(result.message || messages.submitted)
  }

  useEffect(() => {
    if (!projectId) return
    const handle = setTimeout(() => {
      void persist('draft')
    }, 900)
    return () => clearTimeout(handle)
  }, [reportDate, projectId, workStatus, wfhReason, doneToday, nextPlan, blockers])

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-xl">Daily report · {reportDate}</CardTitle>
            <CardDescription className="mt-2">A short update for the team. One report per person per date.</CardDescription>
          </div>
          <p className="text-xs text-slate-400">{savedAt ? `Draft saved at ${savedAt}` : 'Draft saves automatically'}</p>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <div className="flex items-start gap-2 rounded-xl bg-orange-50 p-3 text-sm text-orange-800">
          <Info className="mt-0.5 size-4 shrink-0" />
          <span>You can submit or edit until the end of the next calendar day (Asia/Saigon). After that, changes are rejected.</span>
        </div>
        {status === 'submitted' && submittedAt && (
          <p className="text-sm text-emerald-700">Submitted · {new Date(submittedAt).toLocaleString('en-US', { timeZone: 'Asia/Saigon' })}</p>
        )}
        <div className="grid gap-5 md:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="report-date">Report date</Label>
            <Input id="report-date" type="date" min={minDate} max={maxDate} value={reportDate} onChange={(event) => void onDateChange(event.target.value)} />
            {errors.reportDate && <p className="text-sm text-red-600">{errors.reportDate}</p>}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="project">Project</Label>
            <select id="project" value={projectId} onChange={(event) => setProjectId(event.target.value)} className="h-9 rounded-lg border border-input bg-transparent px-2.5 text-sm">
              {projects.length === 0 && <option value="">No projects</option>}
              {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
            </select>
            {errors.projectId && <p className="text-sm text-red-600">{errors.projectId}</p>}
          </div>
        </div>
        <fieldset className="flex flex-col gap-3 rounded-xl border border-slate-200 p-4">
          <legend className="px-1 text-sm font-medium">Work status</legend>
          <label className="flex items-center gap-2 text-sm"><input type="radio" name="work-status" checked={workStatus === 'office'} onChange={() => setWorkStatus('office')} /> Office</label>
          <label className="flex items-center gap-2 text-sm"><input type="radio" name="work-status" checked={workStatus === 'wfh'} onChange={() => setWorkStatus('wfh')} /> WFH</label>
        </fieldset>
        {workStatus === 'wfh' && (
          <div className="flex flex-col gap-2">
            <Label htmlFor="wfh-reason">WFH reason <span className="text-red-500">*</span></Label>
            <Input id="wfh-reason" value={wfhReason} onChange={(event) => setWfhReason(event.target.value)} placeholder="Example: working with a remote partner" aria-required="true" />
            {errors.wfhReason && <p className="text-sm text-red-600">{errors.wfhReason}</p>}
          </div>
        )}
        <div className="flex flex-col gap-2">
          <Label htmlFor="done">Done today <span className="text-red-500">*</span></Label>
          <Textarea id="done" value={doneToday} onChange={(event) => setDoneToday(event.target.value)} placeholder="Summarize what you finished..." rows={4} required />
          {errors.doneToday && <p className="text-sm text-red-600">{errors.doneToday}</p>}
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="next">Next plan <span className="text-red-500">*</span></Label>
          <Textarea id="next" value={nextPlan} onChange={(event) => setNextPlan(event.target.value)} placeholder="What will you do next?" rows={3} required />
          {errors.nextPlan && <p className="text-sm text-red-600">{errors.nextPlan}</p>}
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="blocker">Blockers <span className="font-normal text-slate-400">(optional)</span></Label>
          <Textarea id="blocker" value={blockers} onChange={(event) => setBlockers(event.target.value)} placeholder="Anything the team should help with?" rows={3} />
        </div>
        <div className="flex justify-end gap-3 border-t border-slate-100 pt-5">
          <Button type="button" variant="outline" disabled={pending} onClick={() => void persist('draft')}>Save draft</Button>
          <Button type="button" disabled={pending} onClick={() => void persist('submit')} className="gap-2 bg-[#1b2a41] hover:bg-[#263b59]">
            <Check className="size-4" />
            {status === 'submitted' ? 'Update report' : 'Submit report'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
