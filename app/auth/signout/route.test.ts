import { NextRequest } from 'next/server'
import { describe, expect, it } from 'vitest'
import { POST } from '@/app/auth/signout/route'

describe('POST /auth/signout', () => {
  it('clears session cookies and redirects to /login', async () => {
    const request = new NextRequest('http://localhost:3000/auth/signout', {
      method: 'POST',
      headers: {
        cookie: 'sb-abc-auth-token.0=session; sb-abc-auth-token.1=chunk; theme=light',
      },
    })
    const response = await POST(request)
    expect(response.status).toBe(303)
    expect(response.headers.get('location')).toBe('http://localhost:3000/login')
    const setCookies = response.headers.getSetCookie()
    const joined = setCookies.join('\n')
    expect(setCookies.some((cookie) => cookie.startsWith('sb-abc-auth-token.0=') && cookie.includes('Max-Age=0'))).toBe(true)
    expect(setCookies.some((cookie) => cookie.startsWith('sb-abc-auth-token.1=') && cookie.includes('Max-Age=0'))).toBe(true)
    expect(joined).toContain('Secure')
    expect(joined).not.toContain('theme=')
  })
})