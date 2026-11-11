'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { clearLock, isLocked, recordFailure, type LockState } from '@/lib/auth/lockout'
import { clientIp } from '@/lib/auth/request'
import { auth, authReady } from '@/lib/auth/server'
import { getSql } from '@/lib/db'
import { siteUrl } from '@/lib/env'
import { messages } from '@/lib/messages'

export type AuthResult = { error?: string; message?: string }

async function readLock(email: string): Promise<{ ok: true; state: LockState | null } | { ok: false }> {
  const sql = getSql()
  if (!sql) return { ok: true, state: null }
  try {
    const rows = await sql`
      select failed_count, locked_until from public.login_attempts where email = ${email} limit 1
    `
    const data = rows[0]
    if (!data) return { ok: true, state: null }
    return {
      ok: true,
      state: {
        failedCount: Number(data.failed_count ?? 0),
        lockedUntil: data.locked_until ? String(data.locked_until) : null,
      },
    }
  } catch {
    return { ok: false }
  }
}

async function writeLock(email: string, state: LockState, ip: string | null): Promise<'saved' | 'skipped' | 'failed'> {
  const sql = getSql()
  if (!sql) return 'skipped'
  try {
    await sql`
      insert into public.login_attempts (email, ip, failed_count, locked_until, updated_at)
      values (${email}, ${ip}, ${state.failedCount}, ${state.lockedUntil}, ${new Date().toISOString()}::timestamptz)
      on conflict (email) do update set
        ip = excluded.ip,
        failed_count = excluded.failed_count,
        locked_until = excluded.locked_until,
        updated_at = excluded.updated_at
    `
    return 'saved'
  } catch {
    return 'failed'
  }
}

async function audit(action: string, metadata: Record<string, unknown>, actorId?: string | null) {
  const sql = getSql()
  if (!sql) return
  try {
    await sql`
      insert into public.audit_logs (actor_id, action, object_type, metadata, ip)
      values (
        ${actorId ?? null}::uuid,
        ${action},
        'auth',
        ${JSON.stringify(metadata)}::jsonb,
        ${typeof metadata.ip === 'string' ? metadata.ip : null}
      )
    `
  } catch {
    // Best-effort audit.
  }
}

function deactivatedError(message: string): boolean {
  return /ban/i.test(message)
}

export async function signIn(_prev: AuthResult, formData: FormData): Promise<AuthResult> {
  const email = String(formData.get('email') || '').trim().toLowerCase()
  const password = String(formData.get('password') || '')
  if (!email || !password) return { error: messages.invalidCredentials }
  if (!authReady()) return { error: messages.signInUnavailable }

  const ip = await clientIp()
  const now = new Date()
  const existing = await readLock(email)
  if (!existing.ok) return { error: messages.signInUnavailable }
  if (isLocked(existing.state, now)) return { error: messages.locked }

  const { data, error } = await auth.signIn.email({ email, password })
  if (error || !data?.user) {
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

  const sql = getSql()
  if (!sql) return { error: messages.signInUnavailable }
  const profiles = await sql`select status from public.profiles where id = ${data.user.id}::uuid limit 1`
  if (profiles[0]?.status === 'inactive') {
    await auth.signOut()
    await audit('login_denied', { email, ip, reason: 'inactive' }, data.user.id)
    return { error: messages.deactivated }
  }

  await writeLock(email, clearLock(), ip)
  await sql`
    update public.profiles
    set last_activity_at = ${now.toISOString()}::timestamptz
    where id = ${data.user.id}::uuid
  `
  await audit('login_success', { email, ip }, data.user.id)
  redirect('/dashboard')
}

export async function signOut() {
  if (authReady()) {
    try {
      await auth.signOut()
    } catch {
      // Cookie clear on /auth/signout still ends the browser session.
    }
  }
  revalidatePath('/', 'layout')
  redirect('/login')
}

export async function requestPasswordReset(_prev: AuthResult, formData: FormData): Promise<AuthResult> {
  const email = String(formData.get('email') || '').trim().toLowerCase()
  if (!email) return { error: 'Enter the email address for your account.' }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: 'Enter a valid email address.' }
  if (!authReady()) return { error: messages.signInUnavailable }
  const { error } = await auth.requestPasswordReset({
    email,
    redirectTo: `${siteUrl()}/login/update-password`,
  })
  if (error) return { error: messages.resetFailed }
  return { message: messages.resetSent }
}
