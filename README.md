# ICON Team 1 Portal

English internal portal for ICON Team 1. Sign-in is Supabase email and password. Daily reports, WFH declarations, in-app notifications, the team leader dashboard, the member directory, organization settings, and the document library use Supabase. Requests, announcements, the team calendar, report history, and team weekly export stay sample screens.

Environment setup, including the dev project `egylwfpxaxqqlmselygj`, is in [DEPLOY.md](DEPLOY.md). Copy `.env.example` to `.env.local` and fill keys from the dashboard. Never commit secrets.

```bash
pnpm install
pnpm dev
pnpm typecheck
pnpm test
pnpm lint
```

## Quick start

Requirements:

- Node.js 20+
- pnpm 12+

```bash
pnpm install
pnpm dev
```

Open `http://localhost:3000`.

Available scripts:

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Start the Next.js development server |
| `pnpm build` | Create a production build |
| `pnpm start` | Run the production build |
| `pnpm lint` | Lint TypeScript sources |
| `pnpm typecheck` | Run `tsc --noEmit` |
| `pnpm test` | Run unit tests |
| `pnpm seed:dev` | Seed the dev Supabase project (needs service role and `SEED_DEV_PASSWORD` in the shell) |

## Project structure

```text
app/
  page.tsx                         Root redirect/entry page
  login/page.tsx                   Login screen
  dashboard/page.tsx               Member dashboard
  reports/
    daily/new/page.tsx             New daily report
    weekly/new/page.tsx            New weekly report
    history/page.tsx               Report history
  team/
    page.tsx                       Team entry screen
    dashboard/page.tsx             Team submission dashboard
    reports/weekly/page.tsx        Team weekly summary
    calendar/page.tsx              Team Office/WFH/leave calendar
    directory/page.tsx             Member directory
    [id]/page.tsx                  Member profile
  documents/page.tsx               Document workspace
  requests/page.tsx                Support request workflow
  notifications/page.tsx           Notification center
  announcements/page.tsx           Announcement management/feed
  admin/page.tsx                   User and portal settings
components/
  portal-shell.tsx                 Shared header, navigation, and page shell
  portal-provider.tsx              Mock role/session context
  daily-report-form.tsx            Daily report form
  team-screens.tsx                 Team dashboard, calendar, weekly report, requests
  workspace-screens.tsx            Documents, directory, notifications, admin, announcements
  ui/                              Local shadcn-style UI primitives
lib/
  mock-data.ts                     All prototype entities and sample records
  i18n/vi.ts                       Vietnamese labels and copy
  utils.ts                         Shared class-name utilities
public/                            Icons and placeholder assets
```

## Route and story map

| Route | Main component | Story ID(s) |
| --- | --- | --- |
| `/` | `app/page.tsx` | — |
| `/login` | Login page | AUTH-01 |
| `/dashboard` | Dashboard page / `PortalShell` | REP-01 |
| `/reports/daily/new` | `DailyReportForm` | WFH-01 |
| `/reports/weekly/new` | Weekly report page | REP-04 |
| `/reports/history` | Report history page | REP-08 |
| `/team` | Team landing page | — |
| `/team/dashboard` | `TeamDashboard` in `team-screens.tsx` | REP-05, WFH-02 |
| `/team/reports/weekly` | `WeeklyTeamReport` in `team-screens.tsx` | REP-07 |
| `/team/calendar` | `TeamCalendar` in `team-screens.tsx` | WFH-02 |
| `/team/directory` | `DirectoryPanel` | PRO-01 |
| `/team/[id]` | Member profile | PRO-01 |
| `/requests` | `RequestsScreen` in `team-screens.tsx` | REQ-01, REQ-02 |
| `/documents` | `DocumentsLibrary` | DOC-01, DOC-02 |
| `/notifications` | `NotificationCenter` | NTF-01 |
| `/admin` | `AdminPanel` | AUTH-03, ADM-01 |
| `/announcements` | `AnnouncementsScreen` in `workspace-screens.tsx` | ENG-01 |

## Mock data files

- `lib/mock-data.ts` — members, projects, reports, requests, documents, notifications, announcements, calendar entries, and admin users.
- `lib/i18n/vi.ts` — Vietnamese UI labels and localized copy.
- `public/placeholder*.{png,jpg,svg}` — placeholder visual assets used by the prototype.

## What must be replaced before production

This section is intentionally explicit. The current implementation is suitable for UX review only.

### MOCK — authentication

- `/login` accepts the prototype flow without a real identity provider.
- Replace with company SSO/OIDC or a production auth provider.
- Add secure session cookies, password/SSO recovery, logout, session expiry, and audit logging.
- Never trust client-provided role or member IDs.

### MOCK — API and server actions

- Screens read and mutate in-memory/mock values in React state.
- Replace with authenticated Route Handlers or Server Actions.
- Add request validation, error states, loading states, retries, pagination, and server-side filtering.

### MOCK — database

- `lib/mock-data.ts` is the only data source; nothing is persisted.
- Replace with a production database and migrations for users, roles, projects, reports, work location, requests, documents, versions, notifications, announcements, and audit events.
- Enforce tenant/team scoping and server-side authorization on every query.

### MOCK — file storage and document previews

- Upload, version history, PDF/image preview, and CSV import are visual mocks.
- Replace with private object storage, signed upload/download URLs, virus scanning, MIME/size validation, retention rules, version metadata, and a secure preview pipeline.

### MOCK — notifications

- Notification list and header bell are static sample data.
- Replace with persisted notifications plus an event/outbox system, unread counts, read/mark-all-read mutations, delivery preferences, and optional email/push integrations.

### MOCK — role checks and permissions

- `PortalProvider`/`usePortalRole` supplies a client-side demo role.
- Replace with server-derived session claims and permission checks at the route and data layers.
- Implement least-privilege policies for Member, Reviewer, Team Leader, Document Owner, and Admin; hide UI actions only as a convenience, never as the security boundary.

### MOCK — workflow behavior

- Request status changes, announcement posting/pinning, document read confirmations, editable summaries, user deactivation, role assignment, settings, and export buttons are prototype interactions.
- Replace with audited server mutations, optimistic updates with rollback, business-rule validation, and real PDF/Excel export jobs.

### MOCK — reminders, cut-offs, holidays, and calendar

- Report cut-off time, reminder time, CC list, holidays, and Office/WFH/leave calendar values are sample values.
- Replace with persisted organization settings, timezone-aware scheduling, holiday calendars, and background jobs.

## Roles represented in the prototype

- **Member:** submits reports, views documents, confirms important documents, submits requests, and manages permitted profile fields.
- **Reviewer:** read-only access to relevant team/report subsets.
- **Team Leader:** team dashboards, weekly summaries, calendar, requests, announcements, and team directory management views.
- **Document Owner:** document upload/version-management actions.
- **Admin:** user lifecycle, role assignment, CSV import, and portal settings.

## Notes for business analysis

Story IDs are displayed near the relevant screen content where practical, and are also mapped above for traceability. All dates and counts are representative sample data for the 17-member team. Before implementation, confirm the permission matrix, report cut-off semantics, WFH approval rules, document acknowledgement requirements, notification channels, retention/audit requirements, and export formats.
