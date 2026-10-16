# AIRA HRMS

A multi-tenant HRMS (Human Resource Management System) SaaS MVP. Multiple
companies ("tenants") share a single deployed application while their data
stays strictly isolated from one another — every tenant-owned record is
scoped to a `tenant_id` that is always derived server-side from the
authenticated user's membership, never from the client.

The app has two audiences with different levels of access:

- **Platform Super Admin** — a flag (`users.isSuperAdmin`) rather than a
  role, giving cross-tenant visibility over every company on the platform
  (`/admin`).
- **Per-tenant users** — each user belongs to exactly one tenant via a
  `memberships` row that carries their role: `owner`, `admin`, `hr`,
  `manager`, `employee`, or `member`. Owners/HR/Managers use the full HR
  console; employees use a self-service portal.

## Table of contents

- [Technology stack](#technology-stack)
- [Architecture](#architecture)
- [Project structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Environment variables](#environment-variables)
- [Local installation](#local-installation)
- [Database setup](#database-setup)
- [Development](#development)
- [Production build](#production-build)
- [Deploying to Vercel](#deploying-to-vercel)
- [Multi-tenancy](#multi-tenancy)
- [Authentication](#authentication)
- [RBAC (roles & permissions)](#rbac-roles--permissions)
- [Testing](#testing)
- [Known limitations](#known-limitations)

## Technology stack

- **[Next.js 16](https://nextjs.org)** — App Router, running on Turbopack
  (`next dev` / `next build`)
- **TypeScript**
- **Tailwind CSS v4**
- **[shadcn/ui](https://ui.shadcn.com)** — configured with the `base-nova`
  style, built on **`@base-ui/react`** (not Radix — component internals and
  props differ from the Radix-based shadcn you may be used to)
- **[Better Auth](https://www.better-auth.com)** — email/password
  authentication with a Drizzle adapter (`@better-auth/drizzle-adapter`)
- **[Drizzle ORM](https://orm.drizzle.team)** + **drizzle-kit** for schema,
  migrations, and queries
- **Neon Postgres** — serverless Postgres, accessed over a pooled
  connection via `@neondatabase/serverless`'s `Pool` combined with
  `drizzle-orm/neon-serverless` (see `db/index.ts`)
- **Zod** — runtime validation
- **Playwright** — end-to-end tests

## Architecture

```
app/
  (hr)/            HR console route group — owner/admin/hr/manager screens,
                    wrapped by components/layout/hr-layout.tsx via app/(hr)/layout.tsx
                    (dashboard, employees, attendance, leave, payroll,
                    performance, organization, reports, settings, ...)
  employee/         Employee self-service portal (own attendance, leave,
                    payslips, performance)
  admin/             Platform super-admin console (cross-tenant view)
  api/               Route handlers backing all of the above
components/
  hr/                HR console UI building blocks (sidebar, page header,
                    data tables, status badges, etc.)
  ui/                shadcn/ui primitives (base-nova / @base-ui/react)
db/
  schema/            Drizzle table definitions, one module per domain
  index.ts           Drizzle client (Neon pooled connection)
  seed.ts            Demo data seeding script
lib/
  auth.ts            Better Auth instance/config
  authorization.ts   Session → tenant/role resolution + guard helpers
  permissions.ts     RBAC source of truth (roles, permissions, role→perm map)
  notifications.ts   In-app notification helper
e2e/                 Playwright end-to-end tests
```

**Authorization flow.** Every protected API route starts from the
incoming `Request`'s session cookie and funnels through
`lib/authorization.ts`:

- `getCurrentTenant(request)` resolves the Better Auth session to an app
  `user`, looks up their single `memberships` row, and resolves the
  `tenant` it points at. If any step fails, there is no valid tenant
  context — the caller isn't a member of a tenant.
- `requireRole(request, roles[])` calls `getCurrentTenant` and additionally
  checks the caller's membership role is in an allowed list, returning
  `401` (no session/membership) or `403` (wrong role).
- `requirePermission(request, permission)` does the same but checks a
  specific `Permission` against the role via `hasPermission()` from
  `lib/auth/permissions.ts`.
- `requireSuperAdmin(request)` is the separate check used by `/admin` and
  its APIs — it only looks at `users.isSuperAdmin`, independent of any
  tenant membership.

**RBAC data.** `lib/auth/permissions.ts` is the single source of truth for what
each role (`owner`, `admin`, `hr`, `manager`, `employee`, `member`) can do —
it defines the `ROLES` and `PERMISSIONS` constants and the
`ROLE_PERMISSIONS` map that `hasPermission()`/`getRolePermissions()` read
from, and it's what every route handler actually enforces against.
`db/schema/rbac.ts` (`roles`, `permissions`, `role_permissions` tables) is a
**queryable mirror** of that same data, populated by `db/seeds/seed.ts` from
`lib/auth/permissions.ts` — it exists so the `/settings/roles` page can render
roles and their permissions from the database via `GET /api/roles`, not so
that enforcement can be reconfigured through the database. Changing access
control means editing `lib/auth/permissions.ts`.

## Project structure

One Next.js app (App Router). Files are grouped by purpose, and everything is
imported through the `@/` alias (the repository root).

```
app/                    Routes (Next.js App Router)
  (hr)/                 Company portal pages: dashboard, employees, leave, payroll, settings ...
  employee/             My Workspace (employee self-service)
  admin/                Platform owner: create and manage companies
  api/                  REST API route handlers, one folder per resource
  login/  pending-approval/
components/
  ui/                   Design-system primitives (button, dialog, table, select ...)
  layout/               App shell: hr-layout, sidebar, top-navbar, page-header, route-tabs
  shared/               Reusable pieces: confirm-dialog, pagination, status-badge, empty-state ...
  features/             Larger screens shared by portals: recruitment, tickets, expenses, shifts ...
  system/               App-wide helpers: fetch-cache, hydration-flag
hooks/                  React hooks (use-is-hr, use-display-prefs, use-page-title)
lib/
  auth/                 server (Better Auth), client, authorization (roles), permissions,
                        credentials (password hashing), access-gate
  domain/               Business logic: payroll, leave-days, leave-balances, audit, notifications ...
  validation/           Zod schemas and id checks
  format/               Dates, currency, CSV, error messages
  config/               Environment checks and company settings with defaults
  utils.ts              cn() class helper (shadcn convention)
db/
  schema/               Drizzle table definitions, one file per area
  seeds/                Demo data seeds (refuse to run in production)
  reference/            Reference copy of the Better Auth generated schema
  index.ts              Database connection
drizzle/                SQL migrations (generated by drizzle-kit)
scripts/                One-off operator scripts: create-admin, test-db
e2e/                    Playwright end-to-end tests
docs/                   Project documents
proxy.ts                Session gate and cross-site write protection
instrumentation.ts      Startup checks (environment, database warm-up)
```

## Prerequisites

- Node.js (Next.js 16 requires a current Node LTS; Node 20+ is
  recommended — see `devDependencies["@types/node"]` in `package.json`
  targeting Node 20 typings)
- npm
- A [Neon](https://neon.tech) Postgres account/project (or any Postgres
  reachable with a pooled Neon-style connection string)

## Environment variables

Copy `.env.example` to `.env.local` and fill in:

| Variable | Description |
| --- | --- |
| `DATABASE_URL` | Postgres connection string from your Neon project (Dashboard → Connection Details). Use the **pooled** connection string (host contains `-pooler`). |
| `BETTER_AUTH_SECRET` | Secret Better Auth uses to sign sessions/cookies. Generate one with `openssl rand -base64 32`. |
| `BETTER_AUTH_URL` | Base URL Better Auth uses to build callback/redirect URLs. `http://localhost:3000` locally; your deployed URL in production. |
| `CRON_SECRET` | Optional, 16+ characters. Lets a scheduler call `POST /api/internal/webhooks/run` to retry failed webhooks. Without it that address does not exist. |
| `CLAMAV_HOST` / `CLAMAV_PORT` | Optional. A ClamAV daemon (`clamd`) to scan applicants' resumes (port defaults to 3310). When set, a resume that cannot be scanned is refused. |
| `WEBHOOK_ALLOW_PRIVATE_NETWORKS` | Local testing only: lets webhooks use `http://` and private addresses. Never set it on a live server. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `SMTP_SECURE` | Optional. Outgoing email (see [Email, password reset and two-factor sign-in](#email-password-reset-and-two-factor-sign-in)). Email stays off until `SMTP_HOST` and `SMTP_FROM` are set. |

## Local installation

```bash
git clone <repository-url>
cd aira-hrms
npm install
cp .env.example .env.local
# then edit .env.local with your DATABASE_URL / BETTER_AUTH_SECRET / BETTER_AUTH_URL
```

## Database setup

With `.env.local` pointing at your Neon database, run the Drizzle scripts
defined in `package.json`:

```bash
npm run db:generate   # drizzle-kit generate — generate SQL migrations from db/schema/*
npm run db:migrate    # drizzle-kit migrate  — apply pending migrations to DATABASE_URL
npm run db:seed       # tsx db/seeds/seed.ts       — seed demo tenants, users, and sample data
npm run db:test       # tsx scripts/test-db.ts       — sanity-check the DB connection
```

`db:seed` is idempotent (it skips work that's already been seeded) and
creates:

- Two demo tenants — **Acme Corp** (`acme-corp`) and **Globex Inc**
  (`globex-inc`) — each with an `owner`, `hr`, `manager`, and `employee`
  account. The password for every seeded account is **`Passw0rd!123`**.
  - Acme Corp: `owner@acme-corp.test`, `hr@acme-corp.test`,
    `manager@acme-corp.test`, `employee@acme-corp.test`
  - Globex Inc: `owner@globex-inc.test`, `hr@globex-inc.test`,
    `manager@globex-inc.test`, `employee@globex-inc.test`
- Sample data per tenant: departments, designations, a location, leave
  types/balances, a salary structure, and seeded attendance, leave
  requests, a payroll run, and performance goals/reviews for the
  manager/employee pair.
- The RBAC mirror tables (`roles`, `permissions`, `role_permissions`),
  populated from `lib/auth/permissions.ts`.
- A platform super admin: **`superadmin@platform.test`** (same password,
  `users.isSuperAdmin = true`).

The seed script prints the full list of demo credentials to the console
when it finishes.

## Development

```bash
npm run dev
```

Starts the Next.js dev server on Turbopack at
[http://localhost:3000](http://localhost:3000).

## Production build

```bash
npm run build
npm start
```

## Deploying to Vercel

1. Push the repo to GitHub and import it as a new project in Vercel.
2. In the Vercel project's **Settings → Environment Variables**, add
   `DATABASE_URL`, `BETTER_AUTH_SECRET`, and `BETTER_AUTH_URL` for the
   **Production** environment.
   - `DATABASE_URL`: your Neon pooled connection string.
   - `BETTER_AUTH_URL`: the deployed URL Vercel gives you (e.g.
     `https://<your-app>.vercel.app`).
3. Deploy. No `vercel.json` is required — this is a standard Next.js app
   and Vercel's Next.js build preset handles it out of the box.
4. Run `npm run db:migrate` (and optionally `npm run db:seed`) against the
   production `DATABASE_URL` before or after the first deploy.

## Deploying to Render

`render.yaml` in the repo root is a [Render Blueprint](https://render.com/docs/blueprint-spec)
that defines the web service (build, migrations, start command, health check
and environment variables).

1. **Commit and push everything to GitHub.** This includes the new files in
   `drizzle/` (the migrations): without them the build cannot create the
   tables the app needs.
2. In the Render dashboard choose **New → Blueprint** and select the repo.
3. When prompted, fill in:
   - `DATABASE_URL`: your Neon **pooled** connection string, ending in
     `?sslmode=require`.
   - `ADMIN_EMAIL`, `ADMIN_PASSWORD` (12+ characters) and `ADMIN_NAME`: the
     first **platform owner**. `BETTER_AUTH_SECRET` is generated for you.
4. Deploy. The build runs `npm ci` and `npm run build`; when the build ends,
   the `postbuild` hook (`scripts/postbuild.mjs`, active only on Render) runs
   `db:migrate` (schema), `db:seed:rbac` (roles and permissions only, no demo
   accounts) and `db:bootstrap-admin` (creates the platform owner; skipped if
   the variables are empty; never changes an existing login). This also works
   with Render's default build command. If any step fails the deploy stops and
   the previous version keeps serving.
5. Open the service URL, sign in with `ADMIN_EMAIL` / `ADMIN_PASSWORD` and you
   land on **/admin**. Create each company there and give its owner the login;
   there is no public sign-up. Afterwards you can delete `ADMIN_PASSWORD` from
   the Environment tab.
6. Optional: after attaching a custom domain, add
   `BETTER_AUTH_URL=https://your-domain` in the Environment tab. Without it the
   app uses the service's `onrender.com` address (`RENDER_EXTERNAL_URL`).

Production safety checks. The server refuses to start when `BETTER_AUTH_SECRET`
is under 32 characters, `DATABASE_URL` does not enforce TLS, or the base URL is
not https. Demo seeds refuse to run when `NODE_ENV=production`.

Notes:

- The Blueprint uses the `free` plan so it deploys without a card. It sleeps
  after about 15 minutes without traffic (the next visit waits for it to wake)
  and has 512 MB of memory. For real use switch `plan:` to `starter` or higher.
  If a free build runs out of memory, upgrade the plan.
- The free plan has no Shell and no pre-deploy command, which is why migrations
  and the admin bootstrap run in the build step.
- Neon auto-suspends idle databases. `DB_KEEP_WARM=true` keeps it awake with a
  repeating ping (faster first request, but it consumes Neon compute hours
  around the clock). It is off by default in production.
- The database stays on Neon: the app uses `@neondatabase/serverless`, which
  is built for Neon and is not a drop-in for a Render Postgres instance.
  `region: singapore` matches Neon's ap-southeast-1; change both together if
  your Neon project is elsewhere, since each query pays the network round trip.
- Video meetings use the free public Jitsi service unless you set
  `MEETING_BASE_URL` (see "Video meetings and calls").
- Do **not** run `npm run db:seed` against a production database: it creates
  demo accounts that all share a publicly documented password.
- Render's disk is not persistent: the app stores no files locally (documents
  are links), so nothing is lost on redeploy.

Troubleshooting a failed build:

- **`Cannot find module '@tailwindcss/postcss'`** (or `typescript`, `tsx`):
  Render installed production packages only. Everything the build and the
  database scripts need is listed under `dependencies`, so a current checkout
  builds either way. A service created by hand can keep Render's default
  Build Command (`npm install; npm run build`): the database setup runs from
  the `postbuild` hook. Set its **Start Command** to `npm start -- -H 0.0.0.0`.
- **"Invalid email or password" for the admin you set in `ADMIN_EMAIL`**: the
  account is only created when `ADMIN_EMAIL` and `ADMIN_PASSWORD` are set
  during the build, and an existing login is never changed. Check the build
  log for `[postbuild] npm run db:bootstrap-admin` and "Created login".
- **Server exits right after the build** with "Refusing to start...": a
  required variable is missing or unsafe (see "Production safety checks").

As of this writing, no production deployment has been made: there is no
live URL for this project yet.

## Multi-tenancy

Every tenant-owned table (`employees`, `departments`, `attendance`,
`leave_requests`, `payroll_runs`, etc.) carries a `tenant_id` foreign key.
Tenant scoping is never trusted from the client — no query parameter,
header, or request body field is treated as a tenant identifier. Instead,
every API route resolves the caller's tenant server-side through
`getCurrentTenant()` in `lib/authorization.ts` (session → `users` row →
that user's single `memberships` row → the `tenants` row it points at),
and every Drizzle query for tenant data is filtered by that resolved
`tenant_id`.

`e2e/tenant-flows.spec.ts` has automated Playwright tests that log in as
users from both seeded demo tenants and assert cross-tenant data never
leaks — e.g. Acme Corp's owner can see Acme's employees but never Globex's,
and vice versa — plus a set of broken-access-control checks (IDOR attempts,
privilege escalation via the API, etc.).

## Authentication

Authentication is handled by [Better Auth](https://www.better-auth.com)
with the email/password provider enabled (`lib/auth/server.ts`), backed by a
Drizzle adapter against the `auth` schema tables. It's session/cookie
based. `app/api/auth/[...all]/route.ts` is the Better Auth catch-all route
handler that serves sign-up, sign-in, sign-out, and session endpoints
(`/api/auth/sign-in/email`, etc.). Route access control (redirecting
unauthenticated users away from protected pages) is enforced by `proxy.ts`
at the project root.

## RBAC (roles & permissions)

Roles (per-tenant, stored on the `memberships` row): **owner**, **admin**,
**hr**, **manager**, **employee**, **member**.

Platform-level access is a separate concept: the **Platform Super Admin**
is not a role on a membership — it's the `users.isSuperAdmin` boolean,
checked independently via `requireSuperAdmin()` and used to gate `/admin`.

Permissions (`tenant:read`/`manage`, `users:read`/`manage`,
`employees:read`/`manage`, `attendance:read`/`manage`,
`leave:read`/`manage`, `payroll:read`/`manage`,
`performance:read`/`manage`) and the role → permission mapping that
actually gets enforced live in `lib/auth/permissions.ts`. The
`/settings/roles` page in the app displays this same information by
reading it back out of the database — `db/schema/rbac.ts`'s `roles`,
`permissions`, and `role_permissions` tables (populated at seed time from
`lib/auth/permissions.ts`) via `GET /api/roles`.

## Testing

End-to-end tests use Playwright and live in `e2e/`:

- **`e2e/auth.spec.ts`** — tests that don't require a live database
  connection: the login/signup forms render and validate required fields,
  and the route-protection layer (`proxy.ts`) redirects unauthenticated
  users away from the dashboard and other HR routes while leaving
  `/login` and `/api/auth/*` reachable, and returns `401` (not a `500`)
  for unauthenticated API calls.
- **`e2e/tenant-flows.spec.ts`** — tests that run against a real, seeded
  Neon database: login redirects by role, tenant data isolation between
  Acme Corp and Globex Inc, RBAC checks (e.g. an employee cannot approve
  their own leave request or correct their own attendance via the API),
  Super Admin access to `/admin` vs. a regular owner being denied, and a
  set of broken-access-control / IDOR checks (employees blocked from
  tenant-wide payroll, payslips, salary components, other employees'
  attendance, etc., while their own self-service endpoints work).
- **`e2e/leave-enhancements.spec.ts`** — also runs against the seeded
  database: the restructured employee portal (every `/employee/**` section
  loads), Leave Planner, Leave Encashment and Adjustment (including the
  balance math on approval/rejection and that employees can't approve
  their own or another tenant's requests), LTC claims, leave type rules
  management, and cancelling a leave request (pending, approved-with-
  balance-restore, blocked once it's started, and blocked for someone
  else's request).

Run the suite with:

```bash
npm run test:e2e
```

This runs `playwright test`. Per `playwright.config.ts`, Playwright will
auto-start `npm run dev` against `http://localhost:3000` for you if a dev
server isn't already running (`webServer.reuseExistingServer` is enabled
outside of CI). The tenant-isolation and RBAC specs need a real, seeded
Neon database — run `npm run db:migrate` and `npm run db:seed` against a
real `DATABASE_URL` first, since `e2e/auth.spec.ts` notes this environment
otherwise only has a placeholder connection string.

## Known limitations

- **Statutory payroll covers the common Indian cases, not every one.**
  PF, ESI, professional tax and TDS on salary are built in (see
  [Statutory payroll](#statutory-payroll-pf-esi-professional-tax-tds)), but
  surcharge on very high incomes, perquisites, bonus-based PF/ESI rules and
  gratuity are not. Rates and slabs are
  company settings that you must keep in line with current law. Have your
  accountant review the first few payroll runs before relying on them.
- **System settings are persisted server-side, not in `localStorage`.**
  `/settings/system` (`app/(hr)/settings/system/page.tsx`) reads and
  writes tenant-wide preferences through `GET`/`PUT /api/settings/system`
  (`app/api/settings/system/route.ts`), which stores them in the
  `tenants.settings` JSONB column, scoped to the caller's tenant and
  guarded by `requireRole`.
- **Notifications are limited in scope.** In-app notifications
  (`db/schema/notifications.ts`, `lib/notifications.ts`) currently fire
  for: leave request events (creation/approval/rejection, in
  `app/api/leave-requests/[id]/route.ts`), payroll run generation
  (`app/api/payroll/route.ts`), and membership role changes
  (`app/api/memberships/[id]/route.ts`). Other domains (attendance,
  performance, organization changes, etc.) don't yet raise notifications.
  Leave, payroll, meeting and security notices are also emailed when SMTP is
  configured.
- **No production deployment yet.** This project has not been deployed as
  of this writing — there is no live URL.


## Security

- **Credentials:** login ID is the email address. Passwords (min 12 chars) are
  stored only as salted scrypt hashes; DB URL and auth secret live in
  environment variables, never in code. `.env*` is git-ignored.
- **First admin:** `ADMIN_EMAIL=... ADMIN_PASSWORD=... npm run db:create-admin`
  (add `--super-admin` for platform admin). The demo seed refuses to run in
  production unless `ALLOW_DEMO_SEED=true`.
- **Brute force:** sign-in is limited to 5 attempts/minute per IP, sign-up and
  password flows hourly (in-memory counters; switch Better Auth's rate-limit
  storage to `database` if you run more than one instance).
- **Sessions:** 7-day expiry, HttpOnly + Secure + SameSite=Lax cookies.
- **Web hardening:** CSP, HSTS, X-Frame-Options, nosniff, Referrer/Permissions
  policy, `no-store` on all `/api` responses, and a cross-site Origin check on
  every state-changing API call (`proxy.ts`, `next.config.ts`).
- **Fail-fast config:** production start aborts if the secret is short, the DB
  URL lacks TLS, or the base URL is not https (`lib/env.ts`).
- **Tenant isolation:** every query is scoped by tenant and role-checked.

## Accounts: who creates whom

There is no public sign-up (`/signup` redirects to `/login` and
`/api/auth/sign-up/*` returns 403). Access is handed down a chain:

1. **Platform owner** (`users.is_super_admin = true`) signs in and lands on
   **`/admin` (Companies)**. They click **Create company**, enter the company
   name and the owner's name, email (the user ID) and a password (a Generate
   button is provided), and give those credentials to the company.
   They can later set that owner's password again, or **Suspend** / **Restore**
   a company. They never see a company's employees, payroll or other data.
2. **Company owner** signs in and creates their team in
   **Settings -> Users** (email as user ID, role, optional password), and can
   set a new password for anyone ranked below them.
3. Admin / HR repeat that for the roles below them.

Passwords are write-only: stored only as hashes, never shown, only replaced
(which also signs that user out). A suspended company's users are sent to
`/pending-approval` and every company API returns 401 until it is restored.
Create the first platform owner with
`ADMIN_EMAIL=... ADMIN_PASSWORD=... npm run db:create-admin -- --super-admin`.

## Video meetings and calls

The **Workplace** page (My Workspace, and *Team Presence* in the HR console)
lets people start a meeting (**Meet Now**), schedule one with invitees
(**Schedule Meeting**) and call a colleague with the video button on their row.
Invitees get a notification with a **Join meeting** link; scheduled meetings
list under *Meetings* with a Join button (opens 10 minutes before the start).

Video rooms run on [Jitsi Meet](https://jitsi.org/). By default the free public
server `https://meet.jit.si` is used, which means the call itself is hosted by
that service; anyone with a room link can join, so room names are long and
random. Set `MEETING_BASE_URL` to your own Jitsi server to keep calls in-house.
Meeting data (title, time, invitees, room name) is stored in the `meetings` and
`meeting_attendees` tables.

## Email, password reset and two-factor sign-in

**Email** (`lib/email/`). Set `SMTP_HOST` and `SMTP_FROM` (plus `SMTP_PORT`,
`SMTP_USER`, `SMTP_PASS`, `SMTP_SECURE` as your provider needs) and the app
sends mail through any SMTP service. Without them nothing is sent (outside
production the message is printed to the server log, which is handy locally).
Sending never blocks or fails the action that triggered it. What is emailed:

- password-reset links and a "your password was changed" alert (always);
- meeting invites, calls and cancellations, and the two-factor-reset alert
  (always);
- leave submitted / approved / rejected and payroll generated, which follow the
  company's switches in **Settings -> System -> Notifications**.

**Forgot password** (`/forgot-password`, `/reset-password`). The login page
links to it; if email is not configured the page says so and points people to their
administrator. The link is valid for one hour, works
once, and resetting signs the user out of every device. The answer is the same
whether or not the address has an account, so it cannot be used to discover who
has one.

**Payslip PDF.** Each payslip has a **PDF** button: employees download their own
(*My Workspace -> Payslips*), and owner / admin / HR download anyone's from
*Payroll*. The PDF is an A4 statement with earnings, deductions, net pay in
figures and words, generated on demand (`lib/domain/payslip-pdf.ts`); employees
can only fetch their own.

**Two-factor sign-in (TOTP).** Anyone can switch it on from their account menu
(*Two-factor sign-in*): confirm the password, scan the QR code in an
authenticator app (Google Authenticator, Microsoft Authenticator, Authy, ...),
enter the 6-digit code, and save the ten one-time recovery codes. Sign-in then
asks for a code after the password. If someone loses their phone and their
recovery codes, their manager can use **Reset 2FA** (Settings -> Users; the
platform owner does this for company owners on `/admin`). That removes the
second step, signs the person out everywhere, emails them and is recorded in
the audit log. It needs migration `0025_two_factor` (`npm run db:migrate`).

## Statutory payroll (PF, ESI, professional tax, TDS)

Everything here is **off until a company switches it on** in
**Settings -> Payroll Compliance** (owner and admin; HR can read). The rules apply
from the next payroll run; payroll already processed is never rewritten.

| Rule | How it is worked out |
| --- | --- |
| Provident fund | Employee 12% and employer 12% of the employee's basic salary, on at most the wage ceiling (15,000) unless "contribute on the ceiling only" is turned off. The employer share is split into pension (EPS, 8.33% up to the ceiling) and EPF for the return. |
| ESI | 0.75% employee and 3.25% employer of gross pay, only in months when gross is at or below the limit (21,000). Rounded up to the next rupee. |
| Professional tax | A fixed monthly amount from the company's slab table, by gross pay. Starting slabs are provided for Tamil Nadu, Karnataka, Maharashtra, Telangana, Andhra Pradesh, West Bengal and Gujarat; edit them to match your state's current rules. |
| Labour welfare fund | A fixed employee and employer amount in the months you choose (many states collect it once or twice a year). Rates differ by state, so there are no presets: enter your state's amounts. |
| TDS | Each month: project the year's pay (pay so far this financial year plus this month's pay for every month left), compute the year's tax, and spread what is still owed over the months left. New and old regimes, standard deduction, section 87A rebate (with marginal relief in the new regime) and 4% cess, using the FY 2025-26 rules. Surcharge is not applied. |

Each employee's PAN, UAN, ESI number, which schemes apply to them, their tax
regime and (old regime) declared deductions are kept under **Employees -> [person]
-> Statutory** (owner, admin and HR only). The employee's share of PF, ESI,
professional tax and TDS is included in **total deductions**, so net pay, payslips
and CSV exports stay consistent; the payslip PDF itemises them and shows the
employer's contribution. If a company already added a manual "Provident Fund"
(or similar) salary component, remove it when switching the matching rule on,
or the amount is deducted twice.

**Statutory Report** (sidebar, Payroll) shows a month's totals and per-employee
figures with CSV export, and **PF return (ECR)** downloads the EPFO text file for
the month. Every PF member needs a UAN before the ECR can be produced. Check the
file on the EPFO portal before filing.

The calculators are plain functions in `lib/domain/statutory.ts` with the
defaults in `lib/config/statutory.ts`; the rules for a new financial year are
changed there.

## Documents

Employees' documents (offer letters, contracts, ID proofs, ...) are real files:
PDF, PNG, JPG, DOC/DOCX, XLS/XLSX, TXT or CSV, up to 5 MB each. A file's type is
decided from its contents, not its name, so an executable renamed `.pdf`, HTML
and SVG are refused.

- **Who sees what.** Owner, admin and HR see every document of an employee.
  Managers do not. An employee sees what HR shared with them plus what they
  uploaded themselves; HR can mark a document **HR only** (for letters and
  notes), and then the employee cannot list or download it. Employees can delete
  only their own uploads. Anyone else, or a user of another company, gets "not
  found". HR opening someone else's document is written to the audit log.
- **Where files live.** In the database (`document_files`, a Postgres `bytea`
  column, kept apart from the document list). That needs no extra service and
  works on Render's free plan, but it uses your Neon storage, so each company's
  storage is capped by its plan. To move to S3 or Cloudflare R2 later, change
  `lib/domain/document-store.ts` (write) and `app/api/documents/[id]/file/route.ts`
  (read); nothing else touches the bytes.
- **Older uploads** that stored a whole file as a `data:` link are still listed
  and downloadable. Links must be `http(s)` addresses.

## Profile photos

Every employee can have a profile photo, shown in My Workspace (dashboard header,
profile page and top bar) and on the HR employee page. Use the small camera button
on the picture to upload or remove it. The browser crops the picture to a square
and shrinks it to 256 px before uploading, so a stored photo is a few KB. The server
only accepts JPG, PNG or WebP (judged by the file's contents, 1 MB at most).
Anyone in the company can see a colleague's photo; only that employee, or owner /
admin / HR, can change it. Photos live in the `employee_photos` table (migration
`0028_employee_photos`).

## Plans and usage

Each company has a plan (Free, Starter, Growth, Enterprise; catalogue in
`lib/config/plans.ts`) that limits **people** (the larger of its employee records
and its logins) and **document storage**, with an optional expiry date. The
platform owner chooses the plan when creating a company and can change it, override
either limit, or set an expiry at any time with **Plan** on `/admin`; the page also
shows each company's usage (counts only, never its data). Companies that existed
before plans were introduced were moved to Enterprise so nothing changes for them.

When a plan is full or has expired the company can still sign in and read
everything, but adding people (employees or logins) and uploading documents is
refused with a clear message. Owners and admins see their usage under **Settings
-> Plan & Usage** and get a warning banner at 90% and when blocked. There is no
payment processing: plans are set by hand. A payment provider can call the same
"set plan" path later. Plan changes are recorded in the platform audit log.

## Pay by attendance, overtime and payroll tools

**Settings -> Payroll Rules** (owner and admin) turns attendance into pay. Everything is
off until switched on, so payroll keeps paying the full monthly salary.

- **Loss of pay.** Pay is reduced for days not worked: working days with no attendance
  and no approved leave, days marked Absent, and approved leave of a type marked
  **Unpaid** (Leave -> Leave types -> Pay). A day of salary is the monthly pay over the
  calendar days of the month, or over its working days, as you choose. Weekly offs are
  configurable (Sat/Sun by default). Someone who joined mid-month is paid from the day
  they joined. Half days can cost half a day, and every N late marks can cost a day.
  Salary and allowances are both prorated, and PF/ESI/PT/TDS are worked out on what was
  actually earned.
- **Overtime.** Hours between check-in and check-out beyond the standard day, after a
  grace window and rounded down to 1, 15, 30, 45 or 60 minutes, are paid at a multiple of
  the hourly rate (monthly basic over the month's working days over standard hours).
  Optionally every hour on a weekly off or holiday counts.
- **Per-employee salary components.** A salary component can apply to everyone or to one
  employee (Salary Structure -> Add Component -> Applies to).
- **Review & run.** On the Payroll page, **Review & run** shows each person's paid days,
  loss of pay, overtime, adjustments, loan instalment, deductions and net pay before
  anything is saved, then runs payroll.
- **Adjustments.** Bonus, arrears or a one-off deduction for one or many employees for a
  month. Earnings count as gross pay (including for tax); deductions come off net pay.
- **Loans & Advances.** Recorded under Payroll -> Loans & Advances; payroll takes equal
  monthly instalments (never more than is left of the pay) until the balance is zero.
  Employees see their own under Payslips. Deleting a payslip puts its instalment back.
- **Bank file.** **Bank file** on the Payroll page downloads a CSV of the month's net pay
  with each person's account and IFSC (entered under Employees -> Statutory).
- **Locked once paid.** After a month is run for someone, adjustments for that month
  cannot be added or removed; and, when the company pays by attendance or overtime,
  that person's attendance and leave for the month cannot be edited. Delete the payroll
  record first if something genuinely needs correcting.
- **Payslip** shows days paid, loss of pay, overtime, bonus, loan recovery and every
  statutory line.

## Reports and filing files

- **Muster Report** (Reports): a month grid of every employee's day-by-day attendance
  (present, late, half day, absent, paid/unpaid leave, weekly off, holiday) with totals
  and CSV export.
- **Statutory Report** gains filing files next to the PF return: an **ESIC** contribution
  CSV in the portal's column layout (needs each person's ESI number), and CSVs for
  **professional tax**, **TDS** and **LWF**.
- **Reports hub** (Reports, owners/admins/HR): tabs for **Headcount** (by department,
  location, designation or status, plus joiners over 12 months and the full list),
  **Attendance** (per-employee month summary), **Leave** (by type and by employee for a
  year) and **Payroll cost** (by month and by department, with employer contributions).
  Each has department/location filters and a CSV button per table. Managers see the
  Overview tab only.

## Attendance proof and branches

- **Location and selfie at check-in** (Settings -> System, owner and admin). With
  *Require location* on, employees share their browser location when they check in or
  out; with *Require a selfie*, they take a photo. A location (Locations page) can have a
  **punch fence** (latitude, longitude, radius); employees of that location can only
  punch within it. Distance and the selfies are kept and shown to HR on the Attendance
  page. Browsers only share location and camera on https (or localhost).
- **Holidays by location.** A holiday can apply to the whole company or to one location;
  employees see the company's holidays plus their own location's, and payroll and the
  muster report use the same.
- **Custom fields** (Settings -> Custom Fields): up to 20 extra text, number or date
  fields per employee, filled in by HR on the employee's Overview tab.

Not built: native mobile apps, fingerprint/face terminals, live location tracking,
WhatsApp alerts, and interface languages other than English.

## One login for several companies

A person can belong to more than one company with the same email and password, with a
different role in each (HR in one, employee in another). Each company keeps its own
employee record, leave, payslips and data for them; nothing is shared between companies.

- **Switching.** When someone belongs to more than one company, the **Workspace** box in the
  HR sidebar (and **Switch company** in the employee account menu) lets them pick which one
  they are working in; they land on that company's home for their role there. The choice is
  remembered in a cookie, but it is only a preference: every request checks it against the
  person's real memberships, so a forged value gets nothing. Signing in opens the company they
  last used, or their oldest approved one.
- **Adding someone who already has a login.** A company owner, admin or HR adds them by email
  under **Settings -> Users** exactly like anyone else. They get access to this company and
  keep their own password; a password typed for them is ignored (and the page says so).
  The platform owner can likewise create a company whose owner is an existing login: leave
  the password empty on **Create company** and that same login becomes the owner.
- **Protection.** Nobody in one company can set the password or reset the two-factor sign-in
  of someone who also belongs to another company, since that would hand over their access to
  the other company. Those people change their own from their account menu (the Users page
  shows an "Also in another company" tag and hides those buttons). Removing someone from a
  company only removes that company; their login and other companies are untouched.
- **Limits.** Adding is immediate: there is no invitation for the person to accept, and the
  plan limits of each company count them separately.

## Company roles (admin access)

Under **Settings > Roles > Your company's roles**, owners and admins can create roles such as
"Payroll clerk" or "Recruiter". A role starts from Admin, HR Partner or Manager and then
ticks what is allowed, area by area (employees, attendance, leave, payroll, recruitment,
performance, reports, documents, engagement, settings) and action by action (view, add,
change, delete). Assign it under Settings > Users, or when adding a person.

- **A role can only take access away.** The built-in role still decides what a person can
  reach at all; a company role narrows that. A manager-based role with every box ticked still
  cannot open payroll.
- **Enforcement is on the server.** A blocked request returns 403 with the reason, and the
  menu hides pages the role cannot view. On pages that employees also use (their own leave,
  tickets), a restricted person gets the own-data view instead of the company-wide one.
  Endpoints nobody mapped to an area count as Settings.
- Editing a role takes effect at once. A role in use cannot be deleted. Nobody can change
  their own role. Roles belong to one company.

## Connecting the company's website (API only)

The company's own website connects to AIRA through the API only: openings created in
Recruitment are returned to the website's **server**, and applications it sends arrive on the
Recruitment board. There is no embeddable widget, hosted page or public endpoint; everything
needs an API key.

**Set-up for the company**

1. Open AIRA at its live `https://` address, go to **Recruitment > Website connection (API)** and
   create a key (owners and admins only). Choose its permissions, an expiry and, if you can,
   the server address it may be used from. Copy it now: it is shown once.
2. Give the key and the API address to the website developer, to keep on the server.
3. Create openings in Recruitment and tick **Show on the careers page** (or press **Publish**).
   Only published, open jobs are returned; closing an opening removes it.
4. Applications sent through the API appear in **Applied**, tagged "Website", with the resume,
   cover note and details. Click the name to download the resume, rate 1 to 5 and add notes.
   Owners, admins and HR (except company roles without Recruitment access) are notified.

Applicants' stage changes can be pushed back to the website with a webhook (below).

### API keys

- **Keep the key on the server.** It is shown once when created and AIRA stores only a SHA-256
  hash, so it cannot be recovered; lose it and revoke it. Never put a key in web page code.
- **Least privilege.** Each key gets only the permissions chosen when it is created:
  `jobs:read` (published openings, no personal data), `applications:write` (send an
  application) and `applications:read` (applicants' names, emails, phones and stages). New keys
  default to the first two. A key can do nothing else in AIRA.
- **Expiry and revoking.** A key can expire after 30, 90, 180 or 365 days (or never), and
  revoking or expiry takes effect on the very next request. Up to 10 active keys per company;
  creating and revoking are written to the audit log.
- **Limit a key to your server.** When creating a key you can list the IP addresses it may be
  used from. A key limited like this is useless to anyone who copies it from elsewhere. (The
  address is the one the host reports for the caller, as for the rate limits below.)
- **Limits.** 300 requests a minute per key, 60 applications per 10 minutes per key, and a
  caller who sends about 30 wrong keys in ten minutes is refused for the rest of that window
  (good keys are never counted against it). There are no CORS headers on `/api/v1`, so a
  browser on another website cannot use a key it finds.
- **https only.** On a live server a key sent over plain `http://` is refused.

Send the key as `Authorization: Bearer <key>` (or `X-API-Key`); never in the address.

| Call | Needs | Does |
|---|---|---|
| `GET /api/v1/jobs` | `jobs:read` | Published, open jobs |
| `GET /api/v1/jobs/{id}` | `jobs:read` | One of them |
| `POST /api/v1/applications` | `applications:write` | Send an application: a form with a `resume` file, or JSON `{ jobId, name, email, phone?, coverNote?, resume: { fileName, contentBase64 } }` |
| `GET /api/v1/applications?since=&jobId=&stage=&limit=` | `applications:read` | Applicants that came in from the website or API, oldest first (`since` lets you resume where you left off) |

```bash
curl https://YOUR-AIRA-ADDRESS/api/v1/jobs -H "Authorization: Bearer YOUR_KEY"

curl -X POST https://YOUR-AIRA-ADDRESS/api/v1/applications \
  -H "Authorization: Bearer YOUR_KEY" \
  -F jobId=JOB_ID -F name="Asha Rao" -F email=asha@example.com -F resume=@cv.pdf
```

Errors: 401 (no, wrong, expired or revoked key), 403 (the key lacks that permission), 404
(job not published or not yours), 409 (that person already applied), 413/415 (resume too big
or not a PDF/DOC/DOCX), 429 (slow down).

## Webhooks, resume screening and shared limits

**Webhooks (AIRA tells your system).** Under Recruitment > Website connection > Webhook an owner or
admin sets an `https://` address. AIRA calls it with a JSON `POST` when someone applies
(`application.created`) and when the team moves an applicant who came in through the website or
API to another stage (`application.stage_changed`; people the team typed in are never sent).

```json
{ "id": "<delivery id>", "type": "application.created", "createdAt": "2026-10-16T04:32:21Z",
  "data": { "applicationId": "...", "jobId": "...", "jobTitle": "...", "name": "...",
            "email": "...", "phone": null, "stage": "applied", "source": "api" } }
```

- **Verify every call.** Headers `X-AIRA-Event`, `X-AIRA-Delivery` and
  `X-AIRA-Signature: t=<unix time>,v1=<hex>`, where `v1` is the HMAC-SHA256 of `"<t>.<raw body>"`
  with your signing secret. Recompute it, compare in constant time, and reject calls whose `t` is
  more than a few minutes old. The secret (`whsec_...`) is shown once, can be rotated, and the
  delivery id lets you ignore a message you already handled.
- **Answer with any 2xx.** Anything else, or no answer within 5 seconds, is retried after 1 minute,
  5 minutes, 30 minutes, 2 hours and 6 hours, then marked failed. Failed messages can be retried
  from the screen. After 20 failures in a row the webhook is paused. "Send test" sends a `ping`.
- **Retries need a trigger.** A failed message is retried whenever the company has a new event, or
  when `POST /api/internal/webhooks/run` is called with `Authorization: Bearer $CRON_SECRET`.
  Set `CRON_SECRET` (16+ characters) and add a Render Cron Job that calls that address every few
  minutes (`curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" https://YOUR-AIRA-ADDRESS/api/internal/webhooks/run`).
  Without `CRON_SECRET` that address does not exist.
- **AIRA cannot be aimed at your network.** Webhook addresses must be public `https://` addresses
  with no credentials; loopback, private, link-local (cloud metadata), shared and reserved
  addresses are refused when saving and again on every call, the connection is pinned to the
  address that was checked, redirects are not followed and the answer is discarded.
  `WEBHOOK_ALLOW_PRIVATE_NETWORKS=true` lifts this for local testing only; never set it on a live
  server.

**Resume screening.** Besides the type, size and "is this really a PDF/DOC/DOCX" checks, every
resume is screened: PDFs with scripts, launch actions or embedded files (including names hidden
with `#xx` escapes), `.docx` files with macros, ActiveX, embedded objects or programs (and zip
bombs), `.doc` files with macros, and the EICAR test virus are refused with a clear message. If
the host runs ClamAV, set `CLAMAV_HOST` (and `CLAMAV_PORT`, default 3310) and every resume is
also scanned by it; a resume that cannot be scanned is refused rather than let through. This is
screening for what a resume should never contain, not a replacement for antivirus on the
machines that open the files; resumes are only ever offered as downloads.

**Limits shared by all servers.** The API limits are counted in the database (table
`rate_limits`), so they hold across several server instances and restarts. If the database cannot
be reached they fall back to a per-instance counter. On top of the per-visitor limits, one company's
inbox accepts at most 200 applications an hour from all addresses together, so rotating addresses
cannot flood it. The visitor's address comes from the host's `cf-connecting-ip` header (Render
sets it); behind a different proxy, make it forward the real client address.

**Before connecting a website.** Open AIRA at its live `https://` address to copy the API address
and create keys: an address like `http://localhost:3000` only exists on your own computer, and the
panel warns you when you are on one.

