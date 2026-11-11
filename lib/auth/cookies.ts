/** Shared cookie expiry helpers for auth session cleanup. */

export function clearedAuthCookieOptions() {
  return {
    path: '/',
    maxAge: 0,
    expires: new Date(0),
    sameSite: 'lax' as const,
    httpOnly: false,
  }
}

export function alternateExpiredAuthCookies(name: string): string[] {
  const base = `${name}=; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=lax`
  return [`${base}; Secure`, `${base}; HttpOnly`, `${base}; Secure; HttpOnly`]
}
