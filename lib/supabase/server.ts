import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { clearedAuthCookieOptions, supabaseAuthCookieNames } from '@/lib/auth/cookies'
import { publicSupabaseEnv } from '@/lib/supabase/env'

export async function createClient() {
  const env = publicSupabaseEnv()
  if (!env) return null
  const cookieStore = await cookies()
  return createServerClient(env.url, env.anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        } catch {
          // Server Components cannot set cookies. The proxy refreshes the session.
        }
      },
    },
  })
}

/**
 * Revoke this browser's Supabase session and expire every auth cookie still
 * on the request. Server Components cannot write cookies; the sign-out POST
 * and the proxy expire them on the response the browser actually follows.
 */
export async function endSupabaseSession() {
  const supabase = await createClient()
  if (supabase) {
    try {
      await supabase.auth.signOut({ scope: 'global' })
    } catch {
      // Cookie expiry below still ends this browser session.
    }
  }
  const cookieStore = await cookies()
  const options = clearedAuthCookieOptions()
  for (const name of supabaseAuthCookieNames(cookieStore.getAll())) {
    try {
      cookieStore.set(name, '', options)
    } catch {
      // Server Components cannot set cookies. Sign-out POST and the proxy can.
    }
  }
}
