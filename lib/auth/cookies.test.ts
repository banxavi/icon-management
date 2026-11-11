import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

describe('auth sign-out contract', () => {
  it('signs out through a document POST so the browser drops cookies before /login', () => {
    const shell = readFileSync(join(process.cwd(), 'components/portal-shell.tsx'), 'utf8')
    expect(shell).toContain('action="/auth/signout"')
    expect(shell).toContain('method="post"')
    expect(shell).toContain('type="submit"')
    expect(shell).not.toContain('signOut()')
  })

  it('uses Neon Auth for the sign-out route', () => {
    const route = readFileSync(join(process.cwd(), 'app/auth/signout/route.ts'), 'utf8')
    expect(route).toContain("@/lib/auth/server")
    expect(route).toContain('auth.signOut')
    expect(route).not.toContain('@supabase')
  })
})
