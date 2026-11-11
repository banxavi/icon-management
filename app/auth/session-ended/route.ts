import { NextResponse, type NextRequest } from 'next/server'
import { auth, authReady } from '@/lib/auth/server'

export async function GET(request: NextRequest) {
  const redirectUrl = request.nextUrl.clone()
  redirectUrl.pathname = '/login'
  const error = request.nextUrl.searchParams.get('error')
  redirectUrl.search = error ? `?error=${encodeURIComponent(error)}` : ''

  if (authReady()) {
    try {
      await auth.signOut()
    } catch {
      // Continue to login.
    }
  }

  const response = NextResponse.redirect(redirectUrl, 303)
  response.headers.set('Cache-Control', 'private, no-store')
  return response
}
