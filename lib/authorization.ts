import { eq } from "drizzle-orm";

import { db } from "@/db";
import { memberships } from "@/db/schema/memberships";
import { tenants } from "@/db/schema/tenants";
import { users } from "@/db/schema/users";
import { auth } from "@/lib/auth";
import {
  hasPermission,
  ROLES,
  type Permission,
  type Role,
} from "@/lib/permissions";

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

export async function getCurrentTenant(request: Request) {
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session) {
    return null;
  }

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
    .where(eq(users.email, session.user.email))
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