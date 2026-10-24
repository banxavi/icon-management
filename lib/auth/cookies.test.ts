import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  alternateExpiredAuthCookies,
  clearedAuthCookieOptions,
  isSupabaseSessionCookie,
  isVerifiedSignedOut,
  supabaseAuthCookieNames,
  supabaseSessionCookieNames,
} from '@/lib/auth/cookies'

const cookies = [
  { name: 'sb-abc-auth-token' },
  { name: 'sb-abc-auth-token.0' },
  { name: 'sb-abc-auth-token.1' },
  { name: 'sb-abc-auth-token-code-verifier' },
  { name: 'sb-abc-auth-token-flow-abcdefgh-code-verifier' },
  { name: 'theme' },
  { name: 'other-auth-token' },
]

describe('supabase auth cookies', () => {
  it('collects session chunks and PKCE cookies so sign-out can expire all of them', () => {
    expect(supabaseAuthCookieNames(cookies)).toEqual([
      'sb-abc-auth-token',
      'sb-abc-auth-token.0',
      'sb-abc-auth-token.1',
      'sb-abc-auth-token-code-verifier',
      'sb-abc-auth-token-flow-abcdefgh-code-verifier',
    ])
  })

  it('treats only session chunks as a logged-in cookie', () => {
    expect(supabaseSessionCookieNames(cookies)).toEqual([
      'sb-abc-auth-token',
      'sb-abc-auth-token.0',
      'sb-abc-auth-token.1',
    ])
    expect(isSupabaseSessionCookie('sb-abc-auth-token.0')).toBe(true)
    expect(isSupabaseSessionCookie('sb-abc-auth-token-code-verifier')).toBe(false)
  })

  it('expires cookies with the attributes @supabase/ssr used when setting them', () => {
    expect(clearedAuthCookieOptions()).toMatchObject({
      path: '/',
      maxAge: 0,
      sameSite: 'lax',
      httpOnly: false,
    })
    expect(clearedAuthCookieOptions().expires.getTime()).toBe(0)
  })

  it('also expires Secure and HttpOnly variants that a single Set-Cookie cannot cover', () => {
    expect(alternateExpiredAuthCookies('sb-abc-auth-token.0')).toEqual([
      'sb-abc-auth-token.0=; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=lax; Secure',
      'sb-abc-auth-token.0=; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=lax; HttpOnly',
      'sb-abc-auth-token.0=; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=lax; Secure; HttpOnly',
    ])
  })

  it('signs out through a document POST so the browser drops cookies before /login', () => {
    const shell = readFileSync(join(process.cwd(), 'components/portal-shell.tsx'), 'utf8')
    expect(shell).toContain('action="/auth/signout"')
    expect(shell).toContain('method="post"')
    expect(shell).toContain('type="submit"')
    expect(shell).not.toContain('signOut()')
  })

  it('only treats a confirmed missing session as signed out', () => {
    expect(isVerifiedSignedOut(null, false)).toBe(true)
    expect(isVerifiedSignedOut({ name: 'AuthSessionMissingError' }, false)).toBe(true)
    expect(isVerifiedSignedOut({ status: 401 }, false)).toBe(true)
    expect(isVerifiedSignedOut({ status: 403 }, false)).toBe(true)
    expect(isVerifiedSignedOut(null, true)).toBe(false)
    expect(isVerifiedSignedOut({ name: 'AuthRetryableFetchError', status: 500 }, false)).toBe(false)
  })
})
