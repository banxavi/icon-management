import { describe, expect, it } from 'vitest'
import { IDLE_MS, isIdle, isLocked, LOCK_MS, recordFailure } from '@/lib/auth/lockout'

describe('login lockout', () => {
  const start = new Date('2026-10-24T01:00:00Z')

  it('locks on the fifth failure for 15 minutes', () => {
    let state = recordFailure(null, start)
    expect(isLocked(state, start)).toBe(false)
    for (let i = 0; i < 3; i += 1) state = recordFailure(state, start)
    expect(isLocked(state, start)).toBe(false)
    state = recordFailure(state, start)
    expect(state.failedCount).toBe(5)
    expect(isLocked(state, start)).toBe(true)
    expect(isLocked(state, new Date(start.getTime() + LOCK_MS - 1000))).toBe(true)
    expect(isLocked(state, new Date(start.getTime() + LOCK_MS))).toBe(false)
  })

  it('uses an 8 hour idle window', () => {
    expect(IDLE_MS).toBe(8 * 60 * 60 * 1000)
    const seen = new Date('2026-10-24T01:00:00Z')
    expect(isIdle(new Date(seen.getTime() - IDLE_MS).toISOString(), seen)).toBe(false)
    expect(isIdle(new Date(seen.getTime() - IDLE_MS - 1).toISOString(), seen)).toBe(true)
    expect(isIdle(null, seen)).toBe(false)
  })

  it('does not extend a lock that is already active', () => {
    const locked = recordFailure(recordFailure(recordFailure(recordFailure(recordFailure(null, start), start), start), start), start)
    const later = new Date(start.getTime() + 60_000)
    expect(recordFailure(locked, later).lockedUntil).toBe(locked.lockedUntil)
  })
})
