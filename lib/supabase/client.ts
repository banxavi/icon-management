import { createBrowserClient } from '@supabase/ssr'
import { publicSupabaseEnv } from '@/lib/supabase/env'

export function createBrowserSupabase() {
  const env = publicSupabaseEnv()
  if (!env) return null
  return createBrowserClient(env.url, env.anonKey)
}
