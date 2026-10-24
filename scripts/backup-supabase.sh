#!/usr/bin/env bash
# ICON Team 1 Portal — daily logical backup (SKELETON).
# Supabase Free: no PITR; dashboard daily backups are short-lived and not downloadable
# on Free. This script creates our own logical dumps to meet 12-month retention.
#
# Required env (inject from GitHub Actions secrets / secret manager — NEVER hardcode):
#   SUPABASE_DB_URL   Postgres connection string (Session pooler URI, includes password)
# Optional:
#   BACKUP_DIR        default ./backups
#   BACKUP_LABEL      e.g. dev | staging | prod (default: unknown)
#   USE_SUPABASE_CLI  =1 to use `supabase db dump` instead of pg_dump
#
# Retention policy (12 months): keep daily dumps 35 days + first-of-month dumps 12 months.
# Local pruning below is best-effort; the real retention lives in the offsite store
# (e.g. private bucket with lifecycle rule). Free tier GitHub artifacts max 90 days —
# NOT sufficient alone for 12 months.
#
# Scheduling: GitHub Actions cron (see backup.yml.example) or an external cron host.
# Note: Supabase Free pauses inactive projects after ~7 days; a paused DB cannot be dumped.
set -euo pipefail

: "${SUPABASE_DB_URL:?SUPABASE_DB_URL is required (from secrets, never committed)}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
LABEL="${BACKUP_LABEL:-unknown}"
TS="$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$BACKUP_DIR"
umask 077
OUT_SCHEMA="$BACKUP_DIR/${LABEL}-${TS}-schema.sql.gz"
OUT_DATA="$BACKUP_DIR/${LABEL}-${TS}-data.sql.gz"

if [ "${USE_SUPABASE_CLI:-0}" = "1" ]; then
  supabase db dump --db-url "$SUPABASE_DB_URL" | gzip -9 > "$OUT_SCHEMA"
  supabase db dump --db-url "$SUPABASE_DB_URL" --data-only | gzip -9 > "$OUT_DATA"
else
  # pg_dump major version must be >= server version (Supabase currently PG 15/17).
  pg_dump "$SUPABASE_DB_URL" --schema-only --no-owner --no-privileges \
    --schema=public | gzip -9 > "$OUT_SCHEMA"
  pg_dump "$SUPABASE_DB_URL" --data-only --no-owner \
    --schema=public --schema=auth | gzip -9 > "$OUT_DATA"
fi

gzip -t "$OUT_SCHEMA" "$OUT_DATA"
sha256sum "$OUT_SCHEMA" "$OUT_DATA" > "$BACKUP_DIR/${LABEL}-${TS}.sha256"
echo "Backup OK: $OUT_SCHEMA $OUT_DATA"

# TODO: upload to offsite storage with lifecycle rule (12 months), e.g.:
#   aws s3 cp / rclone copy "$BACKUP_DIR" remote:icon-backups/$LABEL/
# Best-effort local prune: dailies older than 35 days, except day-01 files, older than 366 days.
find "$BACKUP_DIR" -name "${LABEL}-*" -mtime +35 ! -name "${LABEL}-??????01T*" -delete || true
find "$BACKUP_DIR" -name "${LABEL}-*" -mtime +366 -delete || true
