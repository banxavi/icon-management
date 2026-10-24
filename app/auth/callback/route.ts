import { NextResponse } from 'next/server'
import { siteUrl } from '@/lib/supabase/env'
import { createClient } from '@/lib/supabase/server'

function safeNext(value: string | null): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return '/dashboard'
  return value
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const next = safeNext(url.searchParams.get('next'))
  if (code) {
    const supabase = await createClient()
    if (supabase) await supabase.auth.exchangeCodeForSession(code)
  }
  return NextResponse.redirect(`${siteUrl()}${next}`)
}
