import { NextResponse, type NextRequest } from 'next/server'
import { auth, authReady } from '@/lib/auth/server'

/**
 * Document POST sign-out. Soft Server Action redirects can leave session cookies
 * that bounce /login back to /dashboard; this route owns the response cookies.
 */
export async function POST(request: NextRequest) {
  const redirectUrl = request.nextUrl.clone()
  redirectUrl.pathname = '/login'
  redirectUrl.search = ''

  if (authReady()) {
    try {
      await auth.signOut()
    } catch {
      // Redirect below still ends this browser navigation.
    }
  }

  const response = NextResponse.redirect(redirectUrl, 303)
  response.headers.set('Cache-Control', 'private, no-store')
  return response
}
