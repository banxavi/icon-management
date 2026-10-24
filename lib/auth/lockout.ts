export const MAX_LOGIN_FAILURES = 5
export const LOCK_MINUTES = 15
export const LOCK_MS = LOCK_MINUTES * 60 * 1000
export const IDLE_MS = 8 * 60 * 60 * 1000
export const ACTIVITY_TOUCH_MS = 5 * 60 * 1000

export type LockState = {
  failedCount: number
  lockedUntil: string | null
}

export function isLocked(state: LockState | null, now: Date): boolean {
  if (!state?.lockedUntil) return false
  return new Date(state.lockedUntil).getTime() > now.getTime()
}

export function recordFailure(state: LockState | null, now: Date): LockState {
  if (isLocked(state, now)) {
    return { failedCount: state?.failedCount ?? MAX_LOGIN_FAILURES, lockedUntil: state?.lockedUntil ?? null }
  }
  const expired = state?.lockedUntil && new Date(state.lockedUntil).getTime() <= now.getTime()
  const base = expired ? 0 : (state?.failedCount ?? 0)
  const failedCount = base + 1
  if (failedCount >= MAX_LOGIN_FAILURES) {
    return { failedCount, lockedUntil: new Date(now.getTime() + LOCK_MS).toISOString() }
  }
  return { failedCount, lockedUntil: null }
}

export function clearLock(): LockState {
  return { failedCount: 0, lockedUntil: null }
}

/** True when the last recorded activity is at least 8 hours before now. */
export function isIdle(lastActivityAt: string | null | undefined, now: Date): boolean {
  if (!lastActivityAt) return false
  const then = new Date(lastActivityAt).getTime()
  if (Number.isNaN(then)) return false
  return now.getTime() - then > IDLE_MS
}

export function shouldTouchActivity(lastActivityAt: string | null | undefined, now: Date): boolean {
  if (!lastActivityAt) return true
  const then = new Date(lastActivityAt).getTime()
  if (Number.isNaN(then)) return true
  return now.getTime() - then > ACTIVITY_TOUCH_MS
}
