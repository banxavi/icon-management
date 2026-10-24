# Staging Security Checklist — Go-live gate (owner: Nhat)

Mark each item ✅ with evidence (screenshot/link/command) before prod sign-off.

## Data & Supabase
- [ ] RLS enabled on **every** table in `public` (Advisor > Security shows 0 "RLS disabled")
- [ ] Policies tested per role (anon / member / lead / admin) — no cross-team reads
- [ ] `SUPABASE_SERVICE_ROLE_KEY` used only in server code (grep: no import in `"use client"` files; not in `NEXT_PUBLIC_*`)
- [ ] Client bundle scanned: no service role key / DB URL in `.next/static`
- [ ] Storage buckets private unless explicitly public; bucket policies reviewed
- [ ] Auth: email confirmation on, min password length ≥ 8, leaked-password check if available
- [ ] Auth Site URL + Redirect URLs list only staging/preview domains (no wildcards beyond project scope)
- [ ] Audit log table written for create/update/delete of sensitive records; not editable by users

## App
- [ ] No Demo role switcher / debug routes / seed admin in staging build
- [ ] Security headers (via next.config): CSP, X-Frame-Options/frame-ancestors, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, HSTS
- [ ] Server actions/API routes check auth + role server-side (not UI-only)
- [ ] Input validation (zod) on all mutations; errors don't leak stack traces
- [ ] `pnpm audit --prod` has no high/critical

## Platform
- [ ] Vercel env vars: secrets marked **Sensitive**; scoped per environment (Preview ≠ Production)
- [ ] No secrets in git history (gitleaks/trufflehog scan clean)
- [ ] Branch protection on `main`: PR required, CI (lint/typecheck/test/build) required, no force-push
- [ ] Vercel Deployment Protection on previews (Vercel Auth) if data is real
- [ ] Backup ran successfully ≥ 1 time and a restore was tested on a scratch project
- [ ] Access review: only needed members on Vercel / Supabase / GitHub
