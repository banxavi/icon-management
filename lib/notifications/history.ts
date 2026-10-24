export const NOTIFICATION_HISTORY_DAYS = 30

export function notificationHistoryStart(now: Date): Date {
  return new Date(now.getTime() - NOTIFICATION_HISTORY_DAYS * 24 * 60 * 60 * 1000)
}

export function isInNotificationHistory(createdAt: string, now: Date): boolean {
  const time = new Date(createdAt).getTime()
  if (Number.isNaN(time)) return false
  return time >= notificationHistoryStart(now).getTime()
}
