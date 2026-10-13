import { and, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { memberships } from "@/db/schema/memberships";
import { tenants } from "@/db/schema/tenants";
import { users } from "@/db/schema/users";
import { employees } from "@/db/schema/employees";
import { leaveBalances, leaveTypes } from "@/db/schema/leaves";
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

  const key = session.user.email;
  const hit = tenantContextCache.get(key);

  if (hit && hit.expires > Date.now()) {
    return hit.value;
  }

  const value = await loadTenantContext(key);

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

async function loadTenantContext(email: string) {

  // A single joined query instead of three sequential round-trips
  // (user -> membership -> tenant) — each round-trip adds real latency,
  // so collapsing them matters a lot under network latency to the DB.
  const [row] = await db
    .select({
      user: users,
      membershipId: memberships.id,
      membershipTenantId: memberships.tenantId,
      membershipRole: memberships.role,
      tenant: tenants,
    })
    .from(users)
    .innerJoin(memberships, eq(memberships.userId, users.id))
    .innerJoin(tenants, eq(tenants.id, memberships.tenantId))
    .where(eq(users.email, email))
    .limit(1);

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
  };
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
