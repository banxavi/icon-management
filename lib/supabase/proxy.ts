import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { alternateExpiredAuthCookies, clearedAuthCookieOptions, isVerifiedSignedOut, supabaseSessionCookieNames } from '@/lib/auth/cookies'
import { shouldRedirectToLogin, skipsSessionRefresh } from '@/lib/auth/paths'
import { publicSupabaseEnv } from '@/lib/supabase/env'

const CACHE_HEADERS = ['cache-control', 'expires', 'pragma'] as const

type PendingCookie = {
  name: string
  value: string
  options?: Parameters<NextResponse['cookies']['set']>[2]
}

function copyCacheHeaders(from: NextResponse, to: NextResponse) {
  for (const header of CACHE_HEADERS) {
    const value = from.headers.get(header)
    if (value) to.headers.set(header, value)
  }
}

function writePending(response: NextResponse, pending: PendingCookie[]) {
  for (const cookie of pending) {
    response.cookies.set(cookie.name, cookie.value, cookie.options)
  }
}

function expireSessionCookies(response: NextResponse, cookies: readonly { name: string }[]) {
  const options = clearedAuthCookieOptions()
  const names = supabaseSessionCookieNames(cookies)
  for (const name of names) {
    response.cookies.set(name, '', options)
  }
  for (const name of names) {
    for (const header of alternateExpiredAuthCookies(name)) {
      response.headers.append('set-cookie', header)
    }
  }
}

export async function updateSession(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Sign-out owns the response cookies. Refreshing the session here would
  // write a new auth cookie onto the same response and undo the logout.
  if (skipsSessionRefresh(pathname)) {
    return NextResponse.next({ request })
  }

  let supabaseResponse = NextResponse.next({ request })
  const env = publicSupabaseEnv()
  const originalCookies = request.cookies.getAll()
  const pending: PendingCookie[] = []
  let user: { id: string } | null = null
  let verifiedSignedOut = false

  if (env && supabaseSessionCookieNames(originalCookies).length > 0) {
    const supabase = createServerClient(env.url, env.anonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          pending.length = 0
          pending.push(...cookiesToSet)
          writePending(supabaseResponse, pending)
          if (headers) {
            for (const [key, value] of Object.entries(headers)) {
              if (value) supabaseResponse.headers.set(key, value)
            }
          }
        },
      },
    })
    try {
      const { data, error } = await supabase.auth.getUser()
      user = data.user
      verifiedSignedOut = isVerifiedSignedOut(error, Boolean(data.user))
    } catch {
      user = null
    }
  }

  const redirectTo = (path: string) => {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = path
    redirectUrl.search = ''
    const response = NextResponse.redirect(redirectUrl)
    writePending(response, pending)
    copyCacheHeaders(supabaseResponse, response)
    if (verifiedSignedOut) expireSessionCookies(response, originalCookies)
    return response
  }

  if (shouldRedirectToLogin(pathname, Boolean(user))) {
    return redirectTo('/login')
  }

  if (user && pathname === '/login') {
    return redirectTo('/dashboard')
  }

  if (verifiedSignedOut) expireSessionCookies(supabaseResponse, originalCookies)
  return supabaseResponse
}
