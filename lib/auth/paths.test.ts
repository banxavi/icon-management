import { describe, expect, it } from 'vitest'
import { shouldRedirectToLogin } from '@/lib/auth/paths'

describe('unauthenticated route guard', () => {
  it('redirects portal routes, including /dashboard, when there is no session', () => {
    expect(shouldRedirectToLogin('/dashboard', false)).toBe(true)
    expect(shouldRedirectToLogin('/reports/daily/new', false)).toBe(true)
    expect(shouldRedirectToLogin('/team/dashboard', false)).toBe(true)
    expect(shouldRedirectToLogin('/admin', false)).toBe(true)
    expect(shouldRedirectToLogin('/', false)).toBe(true)
  })

  it('leaves login, auth callbacks, and API routes to their own handlers', () => {
    expect(shouldRedirectToLogin('/login', false)).toBe(false)
    expect(shouldRedirectToLogin('/login/forgot', false)).toBe(false)
    expect(shouldRedirectToLogin('/login/update-password', false)).toBe(false)
    expect(shouldRedirectToLogin('/auth/callback', false)).toBe(false)
    expect(shouldRedirectToLogin('/api/reports/abc', false)).toBe(false)
  })

  it('does not redirect an authenticated visit to the dashboard', () => {
    expect(shouldRedirectToLogin('/dashboard', true)).toBe(false)
  })
})
