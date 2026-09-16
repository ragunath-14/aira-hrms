
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema/users";
import { tenants } from "@/db/schema/tenants";
import { memberships } from "@/db/schema/memberships";
import { auth } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export async function POST(request: Request) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return Response.json(
        { error: "Unauthorized" },
        { status: 401 },
      );
    }

    // 1. Find or create application user
    let [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, session.user.email))
      .limit(1);

    if (!user) {
      [user] = await db
        .insert(users)
        .values({
          name: session.user.name,
          email: session.user.email,
        })
        .returning();
    }

    // 2. Check whether this user already has a tenant membership
    const [existingMembership] = await db
      .select()
      .from(memberships)
      .where(eq(memberships.userId, user.id))
      .limit(1);

    if (existingMembership) {
      await logAudit({
        tenantId: existingMembership.tenantId,
        userId: user.id,
        action: "login",
        entity: "user",
        entityId: user.id,
      });

      return Response.json({
        user,
        membership: existingMembership,
        message: "User already provisioned",
      });
    }

    // 3. Create a tenant for a new account
    const [tenant] = await db
      .insert(tenants)
      .values({
        name: `${session.user.name}'s Company`,
        slug: `company-${user.id}`,
        email: session.user.email,
      })
      .returning();

    // 4. Make the first user the tenant owner
    const [membership] = await db
      .insert(memberships)
      .values({
        userId: user.id,
        tenantId: tenant.id,
        role: "owner",
      })
      .returning();

    return Response.json(
      {
        user,
        tenant,
        membership,
        message: "User and tenant provisioned successfully",
      },
      {
        status: 201,
      },
    );
  } catch (error) {
    console.error("User provisioning error:", error);

    return Response.json(
      {
        error: "Failed to provision user",
      },
      {
        status: 500,
      },
    );
  }
}
