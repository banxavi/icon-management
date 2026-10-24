import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { alternateExpiredAuthCookies, clearedAuthCookieOptions, supabaseAuthCookieNames } from '@/lib/auth/cookies'
import { publicSupabaseEnv } from '@/lib/supabase/env'

type PendingCookie = {
  name: string
  value: string
  options?: Parameters<NextResponse['cookies']['set']>[2]
}

/**
 * Idle and deactivated sessions land here from the server layout.
 * A Server Component cannot clear the auth cookies, and sending the browser
 * straight to /login lets the proxy send them back to /dashboard.
 */
export async function GET(request: NextRequest) {
  const error = request.nextUrl.searchParams.get('error') === 'deactivated' ? 'deactivated' : 'idle'
  const redirectUrl = request.nextUrl.clone()
  redirectUrl.pathname = '/login'
  redirectUrl.search = `?error=${error}`

  const pending: PendingCookie[] = []
  const env = publicSupabaseEnv()
  if (env) {
    const supabase = createServerClient(env.url, env.anonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          pending.push(...cookiesToSet)
        },
      },
    })
    try {
      await supabase.auth.signOut({ scope: 'global' })
    } catch {
      // Cookie expiry below still ends this browser session.
    }
  }

  const response = NextResponse.redirect(redirectUrl, 303)
  for (const cookie of pending) {
    response.cookies.set(cookie.name, cookie.value, cookie.options)
  }
  const expired = clearedAuthCookieOptions()
  const names = supabaseAuthCookieNames(request.cookies.getAll())
  for (const name of names) {
    response.cookies.set(name, '', expired)
  }
  for (const name of names) {
    for (const header of alternateExpiredAuthCookies(name)) {
      response.headers.append('set-cookie', header)
    }
  }
  response.headers.set('Cache-Control', 'private, no-store')
  return response
}
