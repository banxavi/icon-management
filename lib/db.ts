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

/**
 * Run a query in a transaction with request.jwt.claim.sub / role set so
 * auth.uid() and auth.role() stubs match the signed-in Neon Auth user.
 */
export async function withAuthUid<T extends Record<string, unknown> = Record<string, unknown>>(
  userId: string,
  build: (sql: Sql) => ReturnType<Sql>,
): Promise<T[]> {
  const sql = getSql()
  if (!sql) throw new Error('Database is not configured')
  const results = await sql.transaction((txn) => [
    txn`select set_config('request.jwt.claim.sub', ${userId}, true)`,
    txn`select set_config('request.jwt.claim.role', 'authenticated', true)`,
    build(txn as unknown as Sql),
  ])
  return (results[2] ?? []) as T[]
}
