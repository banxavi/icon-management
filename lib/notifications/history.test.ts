import { describe, expect, it } from 'vitest'
import { isInNotificationHistory, NOTIFICATION_HISTORY_DAYS, notificationHistoryStart } from '@/lib/notifications/history'

describe('notification history', () => {
  it('keeps 30 days and drops older items', () => {
    const now = new Date('2026-10-24T08:00:00.000Z')
    expect(NOTIFICATION_HISTORY_DAYS).toBe(30)
    const start = notificationHistoryStart(now)
    expect(isInNotificationHistory(start.toISOString(), now)).toBe(true)
    expect(isInNotificationHistory(new Date(start.getTime() - 1).toISOString(), now)).toBe(false)
    expect(isInNotificationHistory(now.toISOString(), now)).toBe(true)
  })
})
