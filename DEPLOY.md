# ICON Team 1 Portal — Deploy & Environments

Stack: Next.js (App Router) · TypeScript · Tailwind · shadcn/ui · Supabase · Vercel (Free) · pnpm@12.3.4 · Node 22.
Secrets live **only** in Vercel / Supabase dashboards (and GitHub Actions secrets for backups). Never in git or chat.

## 1. Environment matrix

| | dev | staging | prod |
|---|---|---|---|
| Supabase project | "ICON Management" `egylwfpxaxqqlmselygj` (ap-northeast-1) | `icon-management-staging` `eidprpfsvkbwramncqen` (Free, active) | `icon-prod` (create before go-live) |
| Vercel env (account **banxavi**) | Development (local `.env.local`) | Preview (PR deploys) | Production (`main`) |
| Site URL | `http://localhost:3000` | `https://icon-management-git-*.vercel.app` (preview) | `https://icon-management.vercel.app` (or custom domain) |
| Deploy trigger | local | every PR | merge to `main` **after Nhat's written OK** |
| Backups | none required | daily logical dump | daily logical dump, 12-month retention |

> Free tier: max 2 active Supabase projects per org. dev + staging fill it; prod needs either a second org, pausing dev, or Pro. Decide before go-live.

## 2. Run locally against dev
```bash
pnpm install --frozen-lockfile
cp .env.example .env.local     # fill from Supabase dev > Project Settings > API
pnpm dev                       # http://localhost:3000
```
`.env.local` is gitignored. Do not put the service role key in any `NEXT_PUBLIC_*` var.
Migrations: `supabase link --project-ref egylwfpxaxqqlmselygj && supabase db push` (dev only from laptops).

## 3. Vercel env vars (names only)
| Name | Scope | Sensitive |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Preview → staging, Production → prod | no |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Preview / Production | no (public, RLS-guarded) |
| `SUPABASE_SERVICE_ROLE_KEY` | Preview / Production — **server only** | **yes** |
| `NEXT_PUBLIC_SITE_URL` | Preview / Production | no |

**Account rule:** Vercel Free phải thuộc account **banxavi** (không dùng `nhaweb` / `nhawebvn-4580` làm môi trường chính). Shell nhầm trên `nhawebvn-4580` sẽ bị xóa sau khi có token banxavi. Tạo project `icon-management` dưới banxavi: Next.js, Node 22.x, install `pnpm install --frozen-lockfile`, build `pnpm build`, link `banxavi/icon-management`, Preview on PR. Production go-live only after Nhat's written OK.

## 4. Auth redirect URL checklist (Supabase → Authentication → URL Configuration)
- [ ] dev: Site URL `http://localhost:3000`; Redirect `http://localhost:3000/**`
- [ ] staging: Site URL = stable preview/staging URL; Redirect `https://icon-management-git-*-<vercel-scope>.vercel.app/**`
- [ ] prod: Site URL `https://icon-management.vercel.app` (or custom domain); Redirect same `/**` — no localhost, no preview wildcards
- [ ] App uses `NEXT_PUBLIC_SITE_URL` for `emailRedirectTo` / reset-password links
- [ ] Email provider: email/password on, confirm email on; email templates point to `{{ .SiteURL }}`
- [ ] Free tier built-in SMTP is rate limited (few emails/hour) → configure custom SMTP before UAT

## 5. CI (`.github/workflows/ci.yml`)
Runs on every PR and push to `main`: **lint → typecheck (`tsc --noEmit`) → test → build** (build waits for the other three). Any failure fails the workflow. Build uses dummy **public** env; no secrets in CI. Uses `--frozen-lockfile` when `pnpm-lock.yaml` exists (fallback only for bootstrap).
Branch protection on `main`: require PR + 1 review, require checks `lint`, `typecheck`, `test`, `build`, block force-push/deletion.

## 6. Backups
Supabase Free has **no PITR** and no downloadable backups → we run our own logical dumps.
- Script: `scripts/backup-supabase.sh` (pg_dump or `supabase db dump`, gzip, sha256). Needs `SUPABASE_DB_URL` from secrets.
- Schedule: `scripts/backup.yml.example` → copy to `.github/workflows/backup.yml` once secrets are wired (daily 02:00 Asia/Saigon).
- Retention 12 months: dailies 35 days + monthly 12 months, stored **offsite** (GitHub artifacts max 90 days — not enough alone). Offsite target TBD.
- Restore test: restore into a scratch project at least once before go-live, then quarterly.

## 7. Migrations & rollback
- All schema changes as SQL files in `supabase/migrations/`, applied dev → staging → prod; never edit prod in the dashboard.
- Prefer additive (expand/contract) changes; each migration PR includes a written down/rollback SQL in the PR description.
- Before applying to staging/prod: run backup script manually.
- App rollback: Vercel → Deployments → previous → *Promote / Instant Rollback* (only if schema still compatible).
- DB rollback: apply the down SQL; worst case restore latest dump (data loss since dump — no PITR).

## 8. Free-tier risks
- Supabase Free projects **pause after ~7 days inactivity** (staging especially) → resume manually; backups fail while paused.
- 500 MB DB, 1 GB storage, limited egress; 2 active projects/org.
- No PITR, no SLA; built-in email rate-limited.
- Vercel Hobby: non-commercial use per ToS, no team members, function time limits. Confirm usage fits, or move to Pro.
- GitHub Actions minutes: unlimited on public repos, 2,000 min/month on private Free.

## 9. Production go-live
Requires: staging security checklist (`SECURITY-CHECKLIST-STAGING.md`) fully ✅ and **Nhat's written confirmation**. No silent or automated first prod deploy.
