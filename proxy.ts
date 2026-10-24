import type { NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/proxy'

/**
 * Next.js 16 request proxy (the replacement for middleware.ts).
 * App routes other than /login and /auth/* redirect to /login when there is no Supabase session.
 */
export async function proxy(request: NextRequest) {
  return updateSession(request)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
}
