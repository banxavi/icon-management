import { NextResponse } from 'next/server'
import { isIdle } from '@/lib/auth/lockout'
import { auth, authReady } from '@/lib/auth/server'
import { getSql } from '@/lib/db'
import { messages } from '@/lib/messages'

type Lookup = { status?: string; report?: Record<string, unknown> }

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  if (!authReady()) return NextResponse.json({ error: messages.unauthenticated }, { status: 401 })
  const { data: session } = await auth.getSession()
  const user = session?.user
  if (!user?.id) return NextResponse.json({ error: messages.unauthenticated }, { status: 401 })
  const sql = getSql()
  if (!sql) return NextResponse.json({ error: messages.unauthenticated }, { status: 401 })
  const profiles = await sql`select status, last_activity_at from public.profiles where id = ${user.id}::uuid limit 1`
  const profile = profiles[0]
  if (profile?.status === 'inactive') {
    await auth.signOut()
    return NextResponse.json({ error: messages.deactivated }, { status: 403 })
  }
  if (isIdle(profile?.last_activity_at ? String(profile.last_activity_at) : null, new Date())) {
    await auth.signOut()
    return NextResponse.json({ error: messages.idle }, { status: 401 })
  }

  try {
    const rows = await sql`select public.get_daily_report(${id}::uuid) as payload`
    const lookup = (rows[0]?.payload ?? {}) as Lookup
    if (lookup.status === 'not_found') return NextResponse.json({ error: messages.reportNotFound }, { status: 404 })
    if (lookup.status === 'forbidden' || lookup.status === 'unauthenticated') {
      return NextResponse.json({ error: messages.reportForbidden }, { status: 403 })
    }
    return NextResponse.json({ report: lookup.report ?? null })
  } catch {
    return NextResponse.json({ error: messages.reportForbidden }, { status: 403 })
  }
}
