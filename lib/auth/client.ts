'use client'

import { createAuthClient } from '@neondatabase/auth'
import { SupabaseAuthAdapter } from '@neondatabase/auth/vanilla/adapters'

type SupabaseCompatAuth = {
  signInWithPassword: (args: { email: string; password: string }) => Promise<{ data: unknown; error: { message?: string } | null }>
  signOut: () => Promise<{ error: { message?: string } | null }>
  getSession: () => Promise<{ data: unknown; error: { message?: string } | null }>
  resetPasswordForEmail: (email: string, options?: { redirectTo?: string }) => Promise<{ data: unknown; error: { message?: string } | null }>
}

/**
 * Browser auth client with Supabase-compatible call shapes
 * (signInWithPassword, resetPasswordForEmail, getSession, signOut, …).
 */
export function createBrowserAuth(): SupabaseCompatAuth | null {
  const url = process.env.NEXT_PUBLIC_NEON_AUTH_BASE_URL || process.env.NEON_AUTH_BASE_URL
  if (!url) return null
  return createAuthClient(url, {
    adapter: SupabaseAuthAdapter(),
  }) as unknown as SupabaseCompatAuth
}
