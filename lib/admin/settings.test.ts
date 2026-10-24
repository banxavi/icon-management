import { describe, expect, it } from 'vitest'
import { DAILY_WINDOW_VALUE, parseOrgSettings } from '@/lib/admin/settings'

const valid = {
  timezone: 'Asia/Saigon',
  retentionMonths: '12',
  dailyWindow: DAILY_WINDOW_VALUE,
  maxUploadMb: '50',
  extensions: ['pdf', 'docx', 'xlsx', 'pptx', 'md', 'png', 'jpg'],
  weeklyDeadlineWeekday: '5',
  weeklyDeadlineTime: '17:00',
}

describe('org settings', () => {
  it('accepts the locked operating defaults', () => {
    const parsed = parseOrgSettings(valid)
    expect(parsed.ok).toBe(true)
    if (parsed.ok) {
      expect(parsed.value.timezone).toBe('Asia/Saigon')
      expect(parsed.value.retentionMonths).toBe(12)
      expect(parsed.value.dailyWindow).toBe('end_of_next_calendar_day')
      expect(parsed.value.maxUploadMb).toBe(50)
      expect(parsed.value.weeklyDeadlineWeekday).toBe(5)
      expect(parsed.value.weeklyDeadlineTime).toBe('17:00')
    }
  })

  it('rejects an 18:00 cutoff, a retention under 12 months, and unknown file types', () => {
    const parsed = parseOrgSettings({
      ...valid,
      dailyWindow: '18:00',
      retentionMonths: '24',
      extensions: ['exe'],
    })
    expect(parsed.ok).toBe(false)
    if (!parsed.ok) {
      expect(parsed.errors.some((error) => error.includes('end of the next calendar day'))).toBe(true)
      expect(parsed.errors.some((error) => error.includes('pdf'))).toBe(true)
    }
    expect(parseOrgSettings({ ...valid, retentionMonths: '6' }).ok).toBe(false)
    expect(parseOrgSettings({ ...valid, retentionMonths: '24' }).ok).toBe(false)
    expect(parseOrgSettings({ ...valid, retentionMonths: '12' }).ok).toBe(true)
  })

  it('rejects a weekly deadline that is not a day and 24-hour time', () => {
    const parsed = parseOrgSettings({ ...valid, weeklyDeadlineWeekday: '8', weeklyDeadlineTime: '5pm' })
    expect(parsed.ok).toBe(false)
    if (!parsed.ok) expect(parsed.errors.join(' ')).toMatch(/Friday|17:00/)
  })
})
