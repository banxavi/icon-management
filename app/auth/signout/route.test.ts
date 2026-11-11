import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/auth/server', () => ({
  authReady: () => true,
  auth: {
    signOut: vi.fn(async () => ({ data: null, error: null })),
  },
}))

describe('POST /auth/signout', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('redirects to /login after signing out', async () => {
    const { POST } = await import('@/app/auth/signout/route')
    const { auth } = await import('@/lib/auth/server')
    const request = new NextRequest('http://localhost:3000/auth/signout', { method: 'POST' })
    const response = await POST(request)
    expect(auth.signOut).toHaveBeenCalled()
    expect(response.status).toBe(303)
    expect(response.headers.get('location')).toBe('http://localhost:3000/login')
    expect(response.headers.get('cache-control')).toContain('no-store')
  })
})
