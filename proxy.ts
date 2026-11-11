import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { isPublicPath, shouldRedirectToLogin, skipsSessionRefresh } from '@/lib/auth/paths'
import { auth, authReady } from '@/lib/auth/server'

/**
 * Next.js 16 request proxy. Uses Neon Auth session; public paths and /api/auth stay open.
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

  if (isPublicPath(pathname) || pathname.startsWith('/api/')) {
    // Still let Neon Auth middleware refresh cookies on public pages when present.
    if (pathname === '/login') {
      const { data } = await auth.getSession()
      if (data?.user) {
        const url = request.nextUrl.clone()
        url.pathname = '/dashboard'
        url.search = ''
        return NextResponse.redirect(url)
      }
    }
    return NextResponse.next({ request })
  }

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
