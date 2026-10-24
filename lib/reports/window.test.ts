import { describe, expect, it } from 'vitest'
import { calendarDateInZone, isReportWindowOpen, openReportDateBounds } from '@/lib/reports/window'

describe('daily report window (Asia/Saigon)', () => {
  const reportDate = '2026-10-24'

  it('stays open through 23:59:59 on the next calendar day', () => {
    expect(isReportWindowOpen(reportDate, new Date('2026-10-25T16:59:59Z'))).toBe(true)
    expect(calendarDateInZone(new Date('2026-10-25T16:59:59Z'))).toBe('2026-10-25')
  })

  it('closes at 00:00:00 on the day after next', () => {
    expect(isReportWindowOpen(reportDate, new Date('2026-10-25T17:00:00Z'))).toBe(false)
    expect(calendarDateInZone(new Date('2026-10-25T17:00:00Z'))).toBe('2026-10-26')
  })

  it('allows today and yesterday only as the default date bounds', () => {
    const bounds = openReportDateBounds(new Date('2026-10-24T03:00:00Z'))
    expect(bounds).toEqual({ min: '2026-10-23', max: '2026-10-24' })
  })
})
