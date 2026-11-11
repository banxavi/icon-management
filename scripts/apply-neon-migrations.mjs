/**
 * Apply ICON Supabase migrations to Neon Postgres.
 *
 * Requires DATABASE_URL or DATABASE_URL_UNPOOLED (prefer direct/unpooled).
 * Does not print connection strings. Safe to re-run only on empty/public-fresh DBs
 * for the migration files themselves; bootstrap is idempotent.
 *
 * Usage: node scripts/apply-neon-migrations.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const files = [
  'scripts/neon-bootstrap.sql',
  'supabase/migrations/20261024120000_init_core.sql',
  'supabase/migrations/20261024203000_documents_and_settings.sql',
  'supabase/migrations/20261024233000_weekly_reports_deadline.sql',
]

const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL
if (!url) {
  console.error('Set DATABASE_URL (or DATABASE_URL_UNPOOLED) before applying migrations.')
  process.exit(1)
}

// Rely on connection-string SSL (Neon includes sslmode). Do not disable cert verification.
const client = new pg.Client({ connectionString: url })
await client.connect()
for (const rel of files) {
  const sql = fs.readFileSync(path.join(root, rel), 'utf8')
  process.stdout.write(`Applying ${rel}... `)
  try {
    await client.query('begin')
    await client.query(sql)
    await client.query('commit')
    console.log('ok')
  } catch (err) {
    await client.query('rollback')
    console.log('FAILED')
    console.error(err.message)
    process.exitCode = 1
    break
  }
}
await client.end()
