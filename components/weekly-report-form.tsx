'use client'

import { useState } from 'react'
import { Check } from 'lucide-react'
import { toast } from 'sonner'
import { loadWeeklyContext, saveWeeklyReport, type WeeklyContext } from '@/app/actions/reports'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { messages } from '@/lib/messages'

type Props = {
  initial: WeeklyContext
}

export function WeeklyReportForm({ initial }: Props) {
  const [context, setContext] = useState(initial)
  const [highlights, setHighlights] = useState(initial.report ? initial.report.highlights : initial.suggestion)
  const [progress, setProgress] = useState(initial.report?.progress || '')
  const [risks, setRisks] = useState(initial.report?.risks || '')
  const [nextWeek, setNextWeek] = useState(initial.report?.nextWeek || '')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [pending, setPending] = useState(false)

  function apply(next: WeeklyContext) {
    setContext(next)
    setHighlights(next.report ? next.report.highlights : next.suggestion)
    setProgress(next.report?.progress || '')
    setRisks(next.report?.risks || '')
    setNextWeek(next.report?.nextWeek || '')
    setErrors({})
  }

  async function onWeekChange(weekStart: string) {
    setPending(true)
    const result = await loadWeeklyContext(weekStart)
    setPending(false)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    apply(result.context)
  }

  async function persist(intent: 'draft' | 'submit') {
    setPending(true)
    const result = await saveWeeklyReport({
      weekStart: context.weekStart,
      highlights,
      progress,
      risks,
      nextWeek,
      intent,
    })
    setPending(false)
    if (!result.ok) {
      setErrors(result.fieldErrors ?? {})
      toast.error(result.error || messages.saveFailed)
      return
    }
    setErrors({})
    if (result.context) apply(result.context)
    toast.success(result.message || messages.weeklySubmitted)
  }

  const submittedAt = context.report?.submittedAt

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader>
        <CardTitle className="text-xl">Weekly report · {context.weekLabel}</CardTitle>
        <CardDescription className="mt-2">One report per member per week. Deadline: {context.deadlineLabel}.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        {context.pastDeadline && (
          <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
            The deadline for this week was {context.deadlineLabel}. You can still save this report.
          </p>
        )}
        {context.report?.status === 'submitted' && submittedAt && (
          <p className="text-sm text-emerald-700">Submitted · {new Date(submittedAt).toLocaleString('en-US', { timeZone: 'Asia/Saigon' })}</p>
        )}
        <div className="flex flex-col gap-2">
          <Label htmlFor="week">Week</Label>
          <select
            id="week"
            value={context.weekStart}
            disabled={pending}
            onChange={(event) => void onWeekChange(event.target.value)}
            className="h-9 rounded-lg border border-input bg-transparent px-2.5 text-sm"
          >
            {context.weeks.map((week) => (
              <option key={week.weekStart} value={week.weekStart}>{week.label}</option>
            ))}
          </select>
          {errors.weekStart && <p className="text-sm text-red-600">{errors.weekStart}</p>}
        </div>
        <div className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium">Suggested from Done today</p>
            <Button type="button" variant="outline" disabled={pending || !context.suggestion} onClick={() => setHighlights(context.suggestion)}>
              Use suggestion
            </Button>
          </div>
          <p className="whitespace-pre-wrap text-sm text-slate-600">{context.suggestion || 'No Done today notes in this week yet.'}</p>
        </div>
        <Field id="highlights" label="Highlights" required value={highlights} error={errors.highlights} onChange={setHighlights} placeholder="What stood out this week?" />
        <Field id="progress" label="Main progress" required value={progress} error={errors.progress} onChange={setProgress} placeholder="Which goals moved forward?" />
        <Field id="risks" label="Risks" required value={risks} error={errors.risks} onChange={setRisks} placeholder="What should the team watch?" />
        <Field id="next-week" label="Next week" required value={nextWeek} error={errors.nextWeek} onChange={setNextWeek} placeholder="What is the plan for next week?" />
        <div className="flex justify-end gap-3 border-t border-slate-100 pt-5">
          <Button type="button" variant="outline" disabled={pending} onClick={() => void persist('draft')}>Save draft</Button>
          <Button type="button" disabled={pending} onClick={() => void persist('submit')} className="gap-2 bg-[#1b2a41] hover:bg-[#263b59]">
            <Check className="size-4" />
            {context.report?.status === 'submitted' ? 'Update report' : 'Submit report'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function Field({
  id,
  label,
  required,
  value,
  error,
  onChange,
  placeholder,
}: {
  id: string
  label: string
  required?: boolean
  value: string
  error?: string
  onChange: (value: string) => void
  placeholder: string
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label} {required && <span className="text-red-500">*</span>}</Label>
      <Textarea id={id} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} rows={4} />
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  )
}
