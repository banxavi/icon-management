import { neon, type NeonQueryFunction } from '@neondatabase/serverless'

type Sql = NeonQueryFunction<false, false>

let cached: Sql | null | undefined

/** Server-only Neon Postgres client (tagged template). Returns null when DATABASE_URL is unset. */
export function getSql(): Sql | null {
  if (cached !== undefined) return cached
  const url = process.env.DATABASE_URL || process.env.DATABASE_URL_UNPOOLED
  if (!url) {
    cached = null
    return cached
  }
  cached = neon(url)
  return cached
}

export async function sqlQuery<T extends Record<string, unknown> = Record<string, unknown>>(
  strings: TemplateStringsArray,
  ...values: unknown[]
): Promise<T[]> {
  const sql = getSql()
  if (!sql) return []
  return (await sql(strings, ...values)) as T[]
}
