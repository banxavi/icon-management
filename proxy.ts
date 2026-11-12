import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { isPublicPath, shouldRedirectToLogin, skipsSessionRefresh } from '@/lib/auth/paths'
import { auth, authReady } from '@/lib/auth/server'

/**
 * Next.js 16 request proxy.
 * GET/HEAD portal navigations use Neon Auth's official middleware so the signed
 * session_data cookie is minted/refreshed (sub-ms getSession on later loads).
 * Non-GET (Server Actions / form POSTs) skip that middleware and use a plain
 * getSession gate instead — middleware redirects during cookie refresh can
 * 307 authenticated mutations to /login.
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

  // Tab/page navigations — mint session_data for the RSC fast path.
  if (request.method === 'GET' || request.method === 'HEAD') {
    return auth.middleware({ loginUrl: '/login' })(request)
  }

  // Server Actions / mutations: do not run auth.middleware (redirect-on-refresh
  // can abort POSTs). Still reject clearly logged-out requests at the edge;
  // handlers call requireSession() for the real ACL check.
  const { data } = await auth.getSession()
  if (shouldRedirectToLogin(pathname, Boolean(data?.user))) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.search = ''
    return NextResponse.redirect(url)
  }
  return NextResponse.next({ request })
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
}
