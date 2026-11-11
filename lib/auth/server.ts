import { createNeonAuth } from '@neondatabase/auth/next/server'

function requireAuthEnv() {
  const baseUrl = process.env.NEON_AUTH_BASE_URL
  const secret = process.env.NEON_AUTH_COOKIE_SECRET
  if (!baseUrl || !secret) {
    throw new Error('NEON_AUTH_BASE_URL and NEON_AUTH_COOKIE_SECRET are required')
  }
  return { baseUrl, secret }
}

const env = process.env.NEON_AUTH_BASE_URL && process.env.NEON_AUTH_COOKIE_SECRET
  ? requireAuthEnv()
  : null

/**
 * Next.js Managed Better Auth server. Cookie/session handling for App Router.
 * Prefer this for getSession, signIn.email, handler, and middleware.
 */
export const auth = env
  ? createNeonAuth({
      baseUrl: env.baseUrl,
      cookies: { secret: env.secret },
    })
  : (null as unknown as ReturnType<typeof createNeonAuth>)

export function authReady(): boolean {
  return Boolean(env)
}
