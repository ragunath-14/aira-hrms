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
                    wrapped by components/hr/hr-layout.tsx via app/(hr)/layout.tsx
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
  `lib/permissions.ts`.
- `requireSuperAdmin(request)` is the separate check used by `/admin` and
  its APIs — it only looks at `users.isSuperAdmin`, independent of any
  tenant membership.

**RBAC data.** `lib/permissions.ts` is the single source of truth for what
each role (`owner`, `admin`, `hr`, `manager`, `employee`, `member`) can do —
it defines the `ROLES` and `PERMISSIONS` constants and the
`ROLE_PERMISSIONS` map that `hasPermission()`/`getRolePermissions()` read
from, and it's what every route handler actually enforces against.
`db/schema/rbac.ts` (`roles`, `permissions`, `role_permissions` tables) is a
**queryable mirror** of that same data, populated by `db/seed.ts` from
`lib/permissions.ts` — it exists so the `/settings/roles` page can render
roles and their permissions from the database via `GET /api/roles`, not so
that enforcement can be reconfigured through the database. Changing access
control means editing `lib/permissions.ts`.

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
npm run db:seed       # tsx db/seed.ts       — seed demo tenants, users, and sample data
npm run db:test       # tsx test-db.ts       — sanity-check the DB connection
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
  populated from `lib/permissions.ts`.
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

1. Push the repo to GitHub, then in the Render dashboard choose
   **New → Blueprint** and select the repo.
2. When prompted, paste your Neon **pooled** connection string as
   `DATABASE_URL`. `BETTER_AUTH_SECRET` is generated for you.
3. Deploy. Before each new version goes live Render runs
   `npm run db:migrate` (schema) and `npm run db:seed:rbac` (roles and
   permissions reference rows only, idempotent, no demo accounts); a failure
   in either aborts the deploy and the previous version keeps serving.
4. Open the service URL and use **Sign up**: the first account creates a
   company workspace and becomes its `owner`. Invite everyone else from
   Settings → Users.
5. Optional: after attaching a custom domain, add
   `BETTER_AUTH_URL=https://your-domain` in the service's Environment tab.
   Without it the app uses the service's `onrender.com` address
   (`RENDER_EXTERNAL_URL`).

Notes:

- The Blueprint uses the `starter` plan because pre-deploy commands (the
  migration step) are not available on the free plan. On free, delete the
  `preDeployCommand` line and run `npm run db:migrate` yourself.
- The database stays on Neon: the app uses `@neondatabase/serverless`, which
  is built for Neon and is not a drop-in for a Render Postgres instance.
  `region: ohio` matches Neon's us-east-2; change both together if your Neon
  project is elsewhere, since each query pays the network round trip.
- Do **not** run `npm run db:seed` against a production database: it creates
  demo accounts that all share a publicly documented password.

As of this writing, no production deployment has been made — there is no
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
with the email/password provider enabled (`lib/auth.ts`), backed by a
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
actually gets enforced live in `lib/permissions.ts`. The
`/settings/roles` page in the app displays this same information by
reading it back out of the database — `db/schema/rbac.ts`'s `roles`,
`permissions`, and `role_permissions` tables (populated at seed time from
`lib/permissions.ts`) via `GET /api/roles`.

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

- **Payroll is a basic MVP, not statutory-compliant.** Payroll runs
  compute gross/net pay from basic salary, allowances, and deductions, but
  there is no PF, ESI, TDS, or other statutory payroll compliance (India
  or otherwise) implemented. Do not use this for real payroll processing.
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
- **No production deployment yet.** This project has not been deployed as
  of this writing — there is no live URL.
