'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { clearLock, isLocked, recordFailure, type LockState } from '@/lib/auth/lockout'
import { clientIp } from '@/lib/auth/request'
import { messages } from '@/lib/messages'
import { createAdminClient } from '@/lib/supabase/admin'
import { siteUrl } from '@/lib/supabase/env'
import { createClient, endSupabaseSession } from '@/lib/supabase/server'

export type AuthResult = { error?: string; message?: string }

type LockRead = { ok: true; state: LockState | null } | { ok: false }

async function readLock(email: string): Promise<LockRead> {
  const admin = createAdminClient()
  if (!admin) return { ok: true, state: null }
  const { data, error } = await admin.from('login_attempts').select('failed_count, locked_until').eq('email', email).maybeSingle()
  if (error) return { ok: false }
  if (!data) return { ok: true, state: null }
  return { ok: true, state: { failedCount: data.failed_count ?? 0, lockedUntil: data.locked_until } }
}

async function writeLock(email: string, state: LockState, ip: string | null): Promise<'saved' | 'skipped' | 'failed'> {
  const admin = createAdminClient()
  if (!admin) return 'skipped'
  const { error } = await admin.from('login_attempts').upsert({
    email,
    ip,
    failed_count: state.failedCount,
    locked_until: state.lockedUntil,
    updated_at: new Date().toISOString(),
  })
  return error ? 'failed' : 'saved'
}

async function audit(action: string, metadata: Record<string, unknown>, actorId?: string | null) {
  const admin = createAdminClient()
  if (!admin) return
  await admin.from('audit_logs').insert({
    actor_id: actorId ?? null,
    action,
    object_type: 'auth',
    metadata,
    ip: typeof metadata.ip === 'string' ? metadata.ip : null,
  })
}

function deactivatedError(message: string): boolean {
  return /ban/i.test(message)
}

export async function signIn(_prev: AuthResult, formData: FormData): Promise<AuthResult> {
  const email = String(formData.get('email') || '').trim().toLowerCase()
  const password = String(formData.get('password') || '')
  if (!email || !password) return { error: messages.invalidCredentials }

  const ip = await clientIp()
  const now = new Date()
  const existing = await readLock(email)
  if (!existing.ok) return { error: messages.signInUnavailable }
  if (isLocked(existing.state, now)) {
    return { error: messages.locked }
  }

  const supabase = await createClient()
  if (!supabase) return { error: messages.signInUnavailable }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error || !data.user) {
    const message = error?.message ?? ''
    if (deactivatedError(message)) {
      await audit('login_denied', { email, ip, reason: 'deactivated' })
      return { error: messages.deactivated }
    }
    const next = recordFailure(existing.state, now)
    const saved = await writeLock(email, next, ip)
    if (saved === 'failed') return { error: messages.signInUnavailable }
    await audit(isLocked(next, now) ? 'login_locked' : 'login_failed', { email, ip })
    return { error: isLocked(next, now) ? messages.locked : messages.invalidCredentials }
  }

  const { data: profile } = await supabase.from('profiles').select('status').eq('id', data.user.id).maybeSingle()
  if (profile?.status === 'inactive') {
    await endSupabaseSession()
    await audit('login_denied', { email, ip, reason: 'inactive' }, data.user.id)
    return { error: messages.deactivated }
  }

  await writeLock(email, clearLock(), ip)
  await supabase.from('profiles').update({ last_activity_at: now.toISOString() }).eq('id', data.user.id)
  await audit('login_success', { email, ip }, data.user.id)
  redirect('/dashboard')
}

export async function signOut() {
  await endSupabaseSession()
  revalidatePath('/', 'layout')
  redirect('/login')
}

export async function requestPasswordReset(_prev: AuthResult, formData: FormData): Promise<AuthResult> {
  const email = String(formData.get('email') || '').trim().toLowerCase()
  if (!email) return { error: 'Enter the email address for your account.' }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: 'Enter a valid email address.' }
  const supabase = await createClient()
  if (!supabase) return { error: messages.signInUnavailable }
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${siteUrl()}/auth/callback?next=/login/update-password`,
  })
  if (error) return { error: messages.resetFailed }
  return { message: messages.resetSent }
}
