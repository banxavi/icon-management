import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { isPublicPath, shouldRedirectToLogin, skipsSessionRefresh } from '@/lib/auth/paths'
import { auth, authReady } from '@/lib/auth/server'

/**
 * Next.js 16 request proxy.
 * Protected portal routes use Neon Auth's official middleware so the signed
 * session_data cookie is minted/refreshed on the response (sub-ms getSession
 * fast path on later navigations). The previous hand-rolled getSession call
 * never attached Set-Cookie, so every tab click could re-hit Neon Auth upstream.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (skipsSessionRefresh(pathname) || pathname.startsWith('/api/auth')) {
    return NextResponse.next({ request })
  }

  if (!authReady()) {
    if (shouldRedirectToLogin(pathname, false)) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      url.search = ''
      return NextResponse.redirect(url)
    }
    return NextResponse.next({ request })
  }

  // API handlers enforce their own auth; do not gate them at the edge.
  if (pathname.startsWith('/api/')) {
    return NextResponse.next({ request })
  }

  // Auth callback / sign-out own cookies; leave them alone.
  if (pathname.startsWith('/auth/')) {
    return NextResponse.next({ request })
  }

  // Logged-in users hitting /login go to the portal.
  if (pathname === '/login') {
    const { data } = await auth.getSession()
    if (data?.user) {
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      url.search = ''
      return NextResponse.redirect(url)
    }
    return NextResponse.next({ request })
  }

  if (isPublicPath(pathname)) {
    return NextResponse.next({ request })
  }

  return auth.middleware({ loginUrl: '/login' })(request)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
}
