/** App site URL (no trailing slash). */
export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, '')
}

export function neonAuthConfigured(): boolean {
  return Boolean(process.env.NEON_AUTH_BASE_URL && process.env.NEON_AUTH_COOKIE_SECRET)
}

export function databaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL || process.env.DATABASE_URL_UNPOOLED)
}
