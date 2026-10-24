import { messages } from '@/lib/messages'
import { isReportWindowOpen } from '@/lib/reports/window'
import type { WorkStatus } from '@/lib/types'

export type ReportInput = {
  reportDate: string
  projectId: string
  workStatus: WorkStatus
  wfhReason: string
  doneToday: string
  nextPlan: string
  blockers: string
  intent: 'draft' | 'submit'
}

export type FieldErrors = Partial<Record<'reportDate' | 'projectId' | 'wfhReason' | 'doneToday' | 'nextPlan' | 'form', string>>

export function validateReportInput(input: ReportInput, now: Date, timeZone?: string): FieldErrors {
  const errors: FieldErrors = {}
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.reportDate)) {
    errors.reportDate = 'Choose a report date.'
  } else if (!isReportWindowOpen(input.reportDate, now, timeZone)) {
    errors.reportDate = messages.windowClosed
  }
  if (!input.projectId) errors.projectId = messages.projectRequired
  if (input.workStatus === 'wfh' && input.intent === 'submit' && !input.wfhReason.trim()) {
    errors.wfhReason = messages.wfhReason
  }
  if (input.intent === 'submit' && !input.doneToday.trim()) errors.doneToday = 'Describe what you did today.'
  if (input.intent === 'submit' && !input.nextPlan.trim()) errors.nextPlan = 'Add the plan for the next day.'
  return errors
}

export function normalizeWorkStatus(value: string): WorkStatus {
  return value === 'wfh' ? 'wfh' : 'office'
}
