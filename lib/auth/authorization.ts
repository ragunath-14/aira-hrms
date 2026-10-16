import { and, asc, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { memberships } from "@/db/schema/memberships";
import { tenants } from "@/db/schema/tenants";
import { users } from "@/db/schema/users";
import { customRoles } from "@/db/schema/custom-roles";
import { denialFor, sanitizePermissions, type CustomRolePermissions } from "@/lib/auth/custom-roles";
import { employees } from "@/db/schema/employees";
import { leaveBalances, leaveTypes } from "@/db/schema/leaves";
import { chooseMembership, readActiveTenantId } from "@/lib/auth/active-tenant";
import { auth } from "@/lib/auth/server";
import {
  hasPermission,
  ROLES,
  type Permission,
  type Role,
} from "@/lib/auth/permissions";

export async function getCurrentUser(request: Request) {
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session) {
    return null;
  }

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, session.user.email))
    .limit(1);

  return user ?? null;
}

type TenantContext = NonNullable<
  Awaited<ReturnType<typeof loadTenantContext>>
>;

// Every API call resolves user -> membership -> tenant, which is a DB round
// trip on each request. Cache the result briefly per user; role/membership
// changes call invalidateTenantContextCache() so they take effect at once.
const TENANT_CONTEXT_TTL_MS = 15_000;
const tenantContextCache = new Map<
  string,
  { expires: number; value: TenantContext }
>();

export function invalidateTenantContextCache() {
  tenantContextCache.clear();
}

// A company can use the portal only after the platform owner approves its
// sign-up. Every tenant-scoped API goes through here, so unapproved (pending
// or rejected) companies are locked out of all data and actions.
export async function getCurrentTenant(request: Request) {
  const context = await getCurrentTenantContext(request);

  if (!context || context.tenant.accessStatus !== "approved") {
    return null;
  }

  return context;
}

async function getCurrentTenantContext(request: Request) {
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session) {
    return null;
  }

  // Which of their companies the person is working in (see active-tenant.ts).
  const preferred = readActiveTenantId(request.headers.get("cookie"));
  const key = `${session.user.email}|${preferred ?? ""}`;
  const hit = tenantContextCache.get(key);

  if (hit && hit.expires > Date.now()) {
    return hit.value;
  }

  const value = await loadTenantContext(session.user.email, preferred);

  if (value) {
    tenantContextCache.set(key, {
      expires: Date.now() + TENANT_CONTEXT_TTL_MS,
      value,
    });
  } else {
    tenantContextCache.delete(key);
  }

  return value;
}

async function loadTenantContext(email: string, preferred: string | null) {

  // A single joined query instead of three sequential round-trips
  // (user -> membership -> tenant) — each round-trip adds real latency,
  // so collapsing them matters a lot under network latency to the DB.
  // A person can belong to several companies: take them all, then pick the
  // one they are working in.
  const all = await db
    .select({
      user: users,
      membershipId: memberships.id,
      membershipTenantId: memberships.tenantId,
      membershipRole: memberships.role,
      customRoleId: memberships.customRoleId,
      customRoleName: customRoles.name,
      customRolePermissions: customRoles.permissions,
      tenant: tenants,
    })
    .from(users)
    .innerJoin(memberships, eq(memberships.userId, users.id))
    .innerJoin(tenants, eq(tenants.id, memberships.tenantId))
    .leftJoin(customRoles, eq(customRoles.id, memberships.customRoleId))
    .where(eq(users.email, email))
    .orderBy(asc(memberships.createdAt), asc(memberships.id));

  const row = chooseMembership(
    all.map((r) => ({ ...r, tenantId: r.membershipTenantId, accessStatus: r.tenant.accessStatus })),
    preferred,
  );

  if (!row) {
    return null;
  }

  const validRoles = Object.values(ROLES);

  if (!validRoles.includes(row.membershipRole as Role)) {
    return null;
  }

  return {
    user: row.user,
    tenant: row.tenant,
    membership: {
      membershipId: row.membershipId,
      tenantId: row.membershipTenantId,
      role: row.membershipRole as Role,
    },
    // Set when this person was given one of the company's own roles. It only
    // ever narrows what their built-in role allows (see custom-roles.ts).
    customRole:
      row.customRoleId && row.customRoleName
        ? {
            id: row.customRoleId,
            name: row.customRoleName,
            permissions: sanitizePermissions(row.customRolePermissions) as CustomRolePermissions,
          }
        : null,
  };
}

// The reason a custom role blocks this request, or null.
function customRoleDenial(
  context: NonNullable<Awaited<ReturnType<typeof getCurrentTenant>>>,
  request: Request,
) {
  if (!context.customRole) return null;

  return denialFor(
    context.customRole.name,
    context.customRole.permissions,
    new URL(request.url).pathname,
    request.method,
  );
}

export async function requirePermission(
  request: Request,
  permission: Permission,
) {
  const context = await getCurrentTenant(request);

  if (!context) {
    return {
      authorized: false as const,
      status: 401,
      error: "Unauthorized",
    };
  }

  const role = context.membership.role;

  if (!hasPermission(role, permission)) {
    return {
      authorized: false as const,
      status: 403,
      error: "Forbidden",
    };
  }

  const denied = customRoleDenial(context, request);

  if (denied) {
    return { authorized: false as const, status: 403, error: denied };
  }

  return {
    authorized: true as const,
    ...context,
  };
}
export async function requireSuperAdmin(request: Request) {
  const user = await getCurrentUser(request);

  if (!user) {
    return {
      authorized: false as const,
      status: 401,
      error: "Unauthorized",
    };
  }

  if (!user.isSuperAdmin) {
    return {
      authorized: false as const,
      status: 403,
      error: "Forbidden",
    };
  }

  return {
    authorized: true as const,
    user,
  };
}

export async function requireRole(
  request: Request,
  roles: Role[],
) {
  const context = await getCurrentTenant(request);

  if (!context) {
    return {
      authorized: false as const,
      status: 401,
      error: "Unauthorized",
    };
  }

  const role = context.membership.role as Role;

  if (!roles.includes(role)) {
    return {
      authorized: false as const,
      status: 403,
      error: "Forbidden",
    };
  }

  const denied = customRoleDenial(context, request);

  if (denied) {
    // Endpoints open to employees are everyone's own pages (my leave, my
    // tickets) that show a company-wide view to HR and managers. A person whose
    // company role does not cover this area still gets their own page, just
    // not the company-wide view.
    if (roles.includes("employee")) {
      return { authorized: true as const, ...context, role: "employee" as Role };
    }

    return { authorized: false as const, status: 403, error: denied };
  }

  return {
    authorized: true as const,
    ...context,
    role,
  };
}

export async function getOrCreateCurrentEmployee(
  request: Request,
  options: { autoCreate?: boolean } = { autoCreate: true },
) {
  const context = await getCurrentTenant(request);

  if (!context) {
    return null;
  }

  const { user, tenant } = context;

  // 1. Try finding by userId + tenantId
  let [employee] = await db
    .select()
    .from(employees)
    .where(
      and(
        eq(employees.userId, user.id),
        eq(employees.tenantId, tenant.id),
      ),
    )
    .limit(1);

  // 2. If not found, try matching by email in the same tenant
  if (!employee && user.email) {
    const [byEmail] = await db
      .select()
      .from(employees)
      .where(
        and(
          eq(employees.email, user.email),
          eq(employees.tenantId, tenant.id),
        ),
      )
      .limit(1);

    if (byEmail) {
      if (!byEmail.userId) {
        await db
          .update(employees)
          .set({ userId: user.id })
          .where(eq(employees.id, byEmail.id));
      }
      employee = byEmail;
    }
  }

  // 3. If still not found and autoCreate is true (e.g. Owner, HR, Admin accessing My Workspace)
  if (!employee && options.autoCreate !== false) {
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(employees)
      .where(eq(employees.tenantId, tenant.id));

    const nextNumber = Number(countResult[0]?.count ?? 0) + 1;
    const prefix = tenant.slug ? tenant.slug.toUpperCase() : "EMP";
    const employeeCode = `${prefix}-${String(nextNumber).padStart(3, "0")}`;

    const nameParts = (user.name || "Employee").trim().split(/\s+/);
    const firstName = nameParts[0] || "Employee";
    const lastName = nameParts.slice(1).join(" ") || null;

    const [created] = await db
      .insert(employees)
      .values({
        tenantId: tenant.id,
        userId: user.id,
        employeeCode,
        firstName,
        lastName,
        email: user.email,
        status: "active",
        dateOfJoining: new Date(),
      })
      .returning();

    employee = created;

    // Allocate initial leave balances for any leave types configured for this tenant
    const tenantLeaveTypes = await db
      .select()
      .from(leaveTypes)
      .where(eq(leaveTypes.tenantId, tenant.id));

    if (tenantLeaveTypes.length > 0) {
      const currentYear = new Date().getFullYear();
      await db.insert(leaveBalances).values(
        tenantLeaveTypes.map((lt) => ({
          tenantId: tenant.id,
          employeeId: created.id,
          leaveTypeId: lt.id,
          year: currentYear,
          allocatedDays: lt.daysPerYear,
          usedDays: 0,
          remainingDays: lt.daysPerYear,
        })),
      );
    }
  }

  if (!employee) {
    return null;
  }

  return {
    ...context,
    employee,
  };
}

// True when the employee record belongs to the signed-in user. Used to stop
// anyone approving or rejecting their own requests.
export async function isOwnEmployee(employeeId: string, userId: string) {
  const [row] = await db
    .select({ userId: employees.userId })
    .from(employees)
    .where(eq(employees.id, employeeId))
    .limit(1);

  return !!row?.userId && row.userId === userId;
}
