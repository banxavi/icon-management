import { describe, expect, it } from 'vitest'
import { validateReportInput } from '@/lib/reports/validation'

const now = new Date('2026-10-24T03:00:00Z')

const base = {
  reportDate: '2026-10-24',
  projectId: 'p1',
  workStatus: 'office' as const,
  wfhReason: '',
  doneToday: 'Shipped the login screen.',
  nextPlan: 'Wire the leader dashboard.',
  blockers: '',
  intent: 'submit' as const,
}

describe('daily report validation', () => {
  it('requires a WFH reason when work status is WFH', () => {
    const errors = validateReportInput({ ...base, workStatus: 'wfh', wfhReason: '  ' }, now)
    expect(errors.wfhReason).toMatch(/reason/i)
  })

  it('accepts an office report without a WFH reason', () => {
    expect(validateReportInput(base, now)).toEqual({})
  })

  it('rejects a closed report date', () => {
    const errors = validateReportInput({ ...base, reportDate: '2026-10-20' }, now)
    expect(errors.reportDate).toMatch(/closed/i)
  })

  it('allows a partial draft', () => {
    expect(validateReportInput({ ...base, intent: 'draft', doneToday: '', nextPlan: '' }, now)).toEqual({})
  })
})
