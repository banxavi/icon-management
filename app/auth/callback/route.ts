import { NextResponse } from 'next/server'
import { siteUrl } from '@/lib/env'

/** OAuth / magic-link landing. Neon Auth handles the session via /api/auth; this keeps a stable app route. */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const next = url.searchParams.get('next') || '/dashboard'
  const target = new URL(next.startsWith('/') ? next : '/dashboard', siteUrl())
  return NextResponse.redirect(target)
}
