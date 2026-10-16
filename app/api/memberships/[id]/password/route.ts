import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/db";
import { memberships } from "@/db/schema/memberships";
import { users } from "@/db/schema/users";
import { logAudit } from "@/lib/domain/audit";
import { requireRole } from "@/lib/auth/authorization";
import { SHARED_LOGIN_MESSAGE, belongsToOtherCompany, canSetPasswordFor, setLoginPassword } from "@/lib/auth/credentials";
import { isUuid } from "@/lib/validation/ids";
import { createNotification } from "@/lib/domain/notifications";
import type { Role } from "@/lib/auth/permissions";

const bodySchema = z.object({
  password: z.string().min(12).max(128),
});

type RouteContext = {
  params: Promise<{ id: string }>;
};

// Set a new password for a team member. Write-only: there is no way to read
// an existing password back, only to replace it.
export async function PUT(request: Request, { params }: RouteContext) {
  try {
    const auth = await requireRole(request, ["owner", "admin", "hr"]);

    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { id } = await params;
    if (!isUuid(id)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Password must be 12 to 128 characters" },
        { status: 400 },
      );
    }

    const [target] = await db
      .select({
        membershipId: memberships.id,
        userId: users.id,
        name: users.name,
        email: users.email,
        role: memberships.role,
        isSuperAdmin: users.isSuperAdmin,
      })
      .from(memberships)
      .innerJoin(users, eq(users.id, memberships.userId))
      .where(
        and(
          eq(memberships.id, id),
          eq(memberships.tenantId, auth.tenant.id),
        ),
      )
      .limit(1);

    if (!target) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    if (target.isSuperAdmin || !canSetPasswordFor(auth.role, target.role as Role)) {
      return NextResponse.json(
        { error: "You cannot change this user's password" },
        { status: 403 },
      );
    }

    if (await belongsToOtherCompany(target.userId, auth.tenant.id)) {
      return NextResponse.json({ error: SHARED_LOGIN_MESSAGE }, { status: 409 });
    }

    const created = await setLoginPassword({
      email: target.email,
      name: target.name,
      password: parsed.data.password,
    });

    await logAudit({
      tenantId: auth.tenant.id,
      userId: auth.user.id,
      action: created ? "login_created" : "password_reset",
      entity: "membership",
      entityId: target.membershipId,
    });

    await createNotification({
      tenantId: auth.tenant.id,
      userId: target.userId,
      type: "password_changed",
      title: "Your password was changed",
      message: "An administrator set a new password for your account.",
    });

    return NextResponse.json({ success: true, created });
  } catch (error) {
    console.error("Set password error:", error);
    return NextResponse.json(
      { error: "Failed to set password" },
      { status: 500 },
    );
  }
}
