import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/db";
import { memberships } from "@/db/schema/memberships";
import { users } from "@/db/schema/users";
import { requireRole } from "@/lib/auth/authorization";
import { canSetPasswordFor, resetTwoFactor } from "@/lib/auth/credentials";
import type { Role } from "@/lib/auth/permissions";
import { logAudit } from "@/lib/domain/audit";
import { createNotification } from "@/lib/domain/notifications";
import { isUuid } from "@/lib/validation/ids";

type Ctx = { params: Promise<{ id: string }> };

// Remove a team member's two-factor sign-in (lost phone and recovery codes).
// Same ranking rule as setting a password: only for roles below yours.
export async function POST(request: Request, { params }: Ctx) {
  try {
    const auth = await requireRole(request, ["owner", "admin", "hr"]);

    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { id } = await params;
    if (!isUuid(id)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const [target] = await db
      .select({
        membershipId: memberships.id,
        userId: users.id,
        email: users.email,
        role: memberships.role,
        isSuperAdmin: users.isSuperAdmin,
      })
      .from(memberships)
      .innerJoin(users, eq(users.id, memberships.userId))
      .where(and(eq(memberships.id, id), eq(memberships.tenantId, auth.tenant.id)))
      .limit(1);

    if (!target) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    if (target.isSuperAdmin || !canSetPasswordFor(auth.role, target.role as Role)) {
      return NextResponse.json(
        { error: "You cannot reset this person's two-factor sign-in" },
        { status: 403 },
      );
    }

    const reset = await resetTwoFactor(target.email);

    if (!reset) {
      return NextResponse.json({ error: "This person has no login yet" }, { status: 404 });
    }

    await logAudit({
      tenantId: auth.tenant.id,
      userId: auth.user.id,
      action: "two_factor_reset",
      entity: "membership",
      entityId: target.membershipId,
    });

    await createNotification({
      tenantId: auth.tenant.id,
      userId: target.userId,
      type: "two_factor_reset",
      title: "Your two-factor sign-in was reset",
      message: "An administrator removed two-factor sign-in from your account. Sign in with your password and set it up again from your account menu.",
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Reset two-factor error:", error);

    return NextResponse.json({ error: "Failed to reset two-factor sign-in" }, { status: 500 });
  }
}
