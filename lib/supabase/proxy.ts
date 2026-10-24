import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { shouldRedirectToLogin } from '@/lib/auth/paths'
import { publicSupabaseEnv } from '@/lib/supabase/env'

function hasSessionCookie(request: NextRequest): boolean {
  return request.cookies.getAll().some((cookie) => cookie.name.includes('-auth-token'))
}

export async function updateSession(request: NextRequest) {
  const { pathname } = request.nextUrl
  let response = NextResponse.next({ request })
  const env = publicSupabaseEnv()
  let user: { id: string } | null = null

  if (env && hasSessionCookie(request)) {
    const supabase = createServerClient(env.url, env.anonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
        },
      },
    })
    try {
      const { data } = await supabase.auth.getUser()
      user = data.user
    } catch {
      user = null
    }
  }

  if (shouldRedirectToLogin(pathname, Boolean(user))) {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = '/login'
    redirectUrl.search = ''
    return NextResponse.redirect(redirectUrl)
  }

  if (user && pathname === '/login') {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = '/dashboard'
    redirectUrl.search = ''
    return NextResponse.redirect(redirectUrl)
  }

  return response
}
