
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema/users";
import { memberships } from "@/db/schema/memberships";
import { auth } from "@/lib/auth/server";
import { logAudit } from "@/lib/domain/audit";

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

    // 3. Companies are created only by the platform owner, so a user with no
    // membership has no access (a platform admin does not need one).
    if (user.isSuperAdmin) {
      return Response.json({ user, message: "Platform administrator" });
    }

    return Response.json(
      { error: "Your account is not linked to any company. Contact your administrator." },
      { status: 403 },
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
