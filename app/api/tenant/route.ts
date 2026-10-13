import { eq } from "drizzle-orm";
import { db } from "@/db";
import { memberships } from "@/db/schema/memberships";
import { tenants } from "@/db/schema/tenants";
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

    const membership = await db
      .select({
        membershipId: memberships.id,
        role: memberships.role,
        tenantId: memberships.tenantId,
      })
      .from(memberships)
      .where(eq(memberships.userId, hrmsUser[0].id))
      .limit(1);

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

    return Response.json({
      user: hrmsUser[0],
      tenant: tenant[0],
      membership: membership[0],
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