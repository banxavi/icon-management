import { NextResponse } from 'next/server'
import { isIdle } from '@/lib/auth/lockout'
import { messages } from '@/lib/messages'
import { createClient, endSupabaseSession } from '@/lib/supabase/server'

type Lookup = { status?: string; report?: Record<string, unknown> }

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  const supabase = await createClient()
  if (!supabase) return NextResponse.json({ error: messages.unauthenticated }, { status: 401 })
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) return NextResponse.json({ error: messages.unauthenticated }, { status: 401 })
  const { data: profile } = await supabase.from('profiles').select('status, last_activity_at').eq('id', auth.user.id).maybeSingle()
  if (profile?.status === 'inactive') {
    await endSupabaseSession()
    return NextResponse.json({ error: messages.deactivated }, { status: 403 })
  }
  if (isIdle(profile?.last_activity_at, new Date())) {
    await endSupabaseSession()
    return NextResponse.json({ error: messages.idle }, { status: 401 })
  }

  const { data, error } = await supabase.rpc('get_daily_report', { p_id: id })
  if (error) return NextResponse.json({ error: messages.reportForbidden }, { status: 403 })
  const lookup = (data ?? {}) as Lookup
  if (lookup.status === 'not_found') return NextResponse.json({ error: messages.reportNotFound }, { status: 404 })
  if (lookup.status === 'forbidden' || lookup.status === 'unauthenticated') {
    return NextResponse.json({ error: messages.reportForbidden }, { status: 403 })
  }
  return NextResponse.json({ report: lookup.report ?? null })
}
