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

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, session.user.email))
    .limit(1);

  if (!user) {
    return null;
  }

  const [membership] = await db
    .select({
      membershipId: memberships.id,
      tenantId: memberships.tenantId,
      role: memberships.role,
    })
    .from(memberships)
    .where(eq(memberships.userId, user.id))
    .limit(1);

  if (!membership) {
    return null;
  }

  const validRoles = Object.values(ROLES);

  if (!validRoles.includes(membership.role as Role)) {
    return null;
  }

  const [tenant] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.id, membership.tenantId))
    .limit(1);

  if (!tenant) {
    return null;
  }

  return {
    user,
    tenant,
    membership: {
      ...membership,
      role: membership.role as Role,
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