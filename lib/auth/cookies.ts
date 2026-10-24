/**
 * Cookie names written by @supabase/ssr. Session cookies are chunked
 * (`sb-<ref>-auth-token`, `sb-<ref>-auth-token.0`, …). PKCE verifiers share
 * the auth-token prefix but are not a logged-in session.
 */
const SAFE_COOKIE_NAME = /^[A-Za-z0-9._-]+$/

export function isSupabaseSessionCookie(name: string): boolean {
  return SAFE_COOKIE_NAME.test(name) && name.startsWith('sb-') && name.includes('-auth-token') && !name.includes('code-verifier')
}

export function isSupabaseAuthCookie(name: string): boolean {
  return SAFE_COOKIE_NAME.test(name) && (isSupabaseSessionCookie(name) || (name.startsWith('sb-') && name.includes('code-verifier')))
}

export function supabaseSessionCookieNames(cookies: readonly { name: string }[]): string[] {
  return cookies.filter((cookie) => isSupabaseSessionCookie(cookie.name)).map((cookie) => cookie.name)
}

export function supabaseAuthCookieNames(cookies: readonly { name: string }[]): string[] {
  return cookies.filter((cookie) => isSupabaseAuthCookie(cookie.name)).map((cookie) => cookie.name)
}

/**
 * Matches @supabase/ssr DEFAULT_COOKIE_OPTIONS (path, sameSite, httpOnly).
 * A deletion with different attributes is stored as a second cookie and the
 * session cookie stays in the browser.
 */
export function clearedAuthCookieOptions() {
  return {
    path: '/',
    maxAge: 0,
    expires: new Date(0),
    sameSite: 'lax' as const,
    httpOnly: false,
  }
}

/**
 * Extra Set-Cookie deletions for attributes the response cookie map cannot
 * store beside the host-only Lax cookie (Secure and HttpOnly). Preview is
 * HTTPS, and a deletion that omits Secure leaves that session cookie in place.
 */
export function alternateExpiredAuthCookies(name: string): string[] {
  const base = `${name}=; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=lax`
  return [`${base}; Secure`, `${base}; HttpOnly`, `${base}; Secure; HttpOnly`]
}

/** True when Auth confirmed there is no session, so leftover cookies must be expired. */
export function isVerifiedSignedOut(error: { status?: number; name?: string } | null, hasUser: boolean): boolean {
  if (hasUser) return false
  if (!error) return true
  if (error.name === 'AuthSessionMissingError') return true
  return error.status === 401 || error.status === 403
}
