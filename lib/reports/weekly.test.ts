import { describe, expect, it } from 'vitest'
import { isPastWeeklyDeadline, isSelectableWeek, suggestFromDailyDone, validateWeeklyInput, weekLabel } from '@/lib/reports/weekly'

describe('weekly report week and deadline (Asia/Saigon)', () => {
  const wednesday = new Date('2026-10-21T03:00:00Z')

  it('uses Monday–Sunday bounds and a Friday 17:00 deadline', () => {
    expect(weekLabel('2026-10-19')).toBe('Oct 19 – Oct 25, 2026')
    expect(isPastWeeklyDeadline('2026-10-19', 5, '17:00', new Date('2026-10-23T09:59:59Z'))).toBe(false)
    expect(isPastWeeklyDeadline('2026-10-19', 5, '17:00', new Date('2026-10-23T10:00:00Z'))).toBe(true)
  })

  it('keeps Sunday evening in the same week and rolls Monday midnight forward', () => {
    expect(isSelectableWeek('2026-10-19', new Date('2026-10-25T16:59:59Z'))).toBe(true)
    expect(isSelectableWeek('2026-10-26', new Date('2026-10-25T17:00:00Z'))).toBe(true)
    expect(isSelectableWeek('2026-10-19', new Date('2026-10-25T17:00:00Z'))).toBe(true)
    expect(isSelectableWeek('2026-10-26', wednesday)).toBe(false)
  })

  it('suggests Done today from that member’s dailies, oldest first', () => {
    const suggestion = suggestFromDailyDone([
      { reportDate: '2026-10-21', doneToday: '  Reviewed the login lockout. ' },
      { reportDate: '2026-10-20', doneToday: 'Shipped the daily form.' },
      { reportDate: '2026-10-22', doneToday: '   ' },
    ])
    expect(suggestion).toBe('2026-10-20\nShipped the daily form.\n\n2026-10-21\nReviewed the login lockout.')
  })

  it('requires the four English fields on submit and allows a partial draft', () => {
    const base = {
      weekStart: '2026-10-19',
      highlights: '',
      progress: '',
      risks: '',
      nextWeek: '',
      intent: 'submit' as const,
    }
    const errors = validateWeeklyInput(base, wednesday)
    expect(errors.highlights).toMatch(/highlights/i)
    expect(errors.progress).toMatch(/progress/i)
    expect(errors.risks).toMatch(/risks/i)
    expect(errors.nextWeek).toMatch(/next week/i)
    expect(validateWeeklyInput({ ...base, intent: 'draft' }, wednesday)).toEqual({})
    expect(validateWeeklyInput({ ...base, weekStart: '2026-10-26' }, wednesday).weekStart).toMatch(/week/i)
  })
})
