import { eq } from "drizzle-orm";
import { db } from "@/db";
import { getActiveMembership, readActiveTenantId } from "@/lib/auth/active-tenant";
import { customRoles } from "@/db/schema/custom-roles";
import { memberships } from "@/db/schema/memberships";
import { tenants } from "@/db/schema/tenants";
import { sanitizePermissions } from "@/lib/auth/custom-roles";
import { users } from "@/db/schema/users";
import { auth } from "@/lib/auth/server";

export async function GET(request: Request) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session) {
      return Response.json(
        {
          error: "Unauthorized",
        },
        {
          status: 401,
        },
      );
    }

    const hrmsUser = await db
      .select()
      .from(users)
      .where(eq(users.email, session.user.email))
      .limit(1);

    if (hrmsUser.length === 0) {
      return Response.json(
        {
          error: "HRMS user not found",
        },
        {
          status: 404,
        },
      );
    }

    // The company they are working in (one login can belong to several).
    const active = await getActiveMembership(
      hrmsUser[0].id,
      readActiveTenantId(request.headers.get("cookie")),
    );
    const membership = active
      ? [{ membershipId: active.membershipId, role: active.role, tenantId: active.tenantId }]
      : [];

    if (membership.length === 0) {
      return Response.json(
        {
          error: "Tenant membership not found",
        },
        {
          status: 404,
        },
      );
    }

    const tenant = await db
      .select()
      .from(tenants)
      .where(eq(tenants.id, membership[0].tenantId))
      .limit(1);

    if (tenant.length === 0) {
      return Response.json(
        {
          error: "Tenant not found",
        },
        {
          status: 404,
        },
      );
    }

    // A company role narrows what the built-in role allows; the sidebar uses
    // this to hide what the person cannot open.
    const [custom] = active?.membershipId
      ? await db
          .select({ id: customRoles.id, name: customRoles.name, permissions: customRoles.permissions })
          .from(memberships)
          .innerJoin(customRoles, eq(customRoles.id, memberships.customRoleId))
          .where(eq(memberships.id, active.membershipId))
          .limit(1)
      : [];

    return Response.json({
      user: hrmsUser[0],
      tenant: tenant[0],
      membership: membership[0],
      customRole: custom ? { id: custom.id, name: custom.name, permissions: sanitizePermissions(custom.permissions) } : null,
    });
  } catch (error) {
    console.error("Tenant context error:", error);

    return Response.json(
      {
        error: "Failed to get tenant context",
      },
      {
        status: 500,
      },
    );
  }
}