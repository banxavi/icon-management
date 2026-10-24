/** Routes that do not require a session. Everything else redirects to /login. */
export function isPublicPath(pathname: string): boolean {
  return pathname === '/login' || pathname.startsWith('/login/') || pathname === '/auth' || pathname.startsWith('/auth/')
}

export function shouldRedirectToLogin(pathname: string, hasUser: boolean): boolean {
  if (pathname.startsWith('/api/')) return false
  if (isPublicPath(pathname)) return false
  return !hasUser
}
