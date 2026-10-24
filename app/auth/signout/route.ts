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
 * Document POST sign-out. The menu used to call a Server Action, which Next
 * answers with a soft redirect that still carries the session cookie. The
 * proxy then sends /login back to /dashboard.
 */
export async function POST(request: NextRequest) {
  const redirectUrl = request.nextUrl.clone()
  redirectUrl.pathname = '/login'
  redirectUrl.search = ''

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
  // cookies.set keeps one Set-Cookie per name. Append the other attribute
  // combinations after that, or they are overwritten.
  for (const name of names) {
    for (const header of alternateExpiredAuthCookies(name)) {
      response.headers.append('set-cookie', header)
    }
  }
  response.headers.set('Cache-Control', 'private, no-store')
  return response
}
