import { NextResponse } from 'next/server'
import { siteUrl } from '@/lib/env'

function safeNext(value: string | null): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return '/dashboard'
  return value
}

/** OAuth / magic-link landing. Neon Auth handles the session via /api/auth; this keeps a stable app route. */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const next = safeNext(url.searchParams.get('next'))
  return NextResponse.redirect(`${siteUrl()}${next}`)
}
