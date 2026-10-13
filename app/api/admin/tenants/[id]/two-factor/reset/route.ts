import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/db";
import { memberships } from "@/db/schema/memberships";
import { users } from "@/db/schema/users";
import { requireSuperAdmin } from "@/lib/auth/authorization";
import { resetTwoFactor } from "@/lib/auth/credentials";
import { logAudit } from "@/lib/domain/audit";
import { createNotification } from "@/lib/domain/notifications";
import { isUuid } from "@/lib/validation/ids";

type Ctx = { params: Promise<{ id: string }> };

// Platform owner: remove a company owner's two-factor sign-in (lost phone and
// recovery codes).
export async function POST(request: Request, { params }: Ctx) {
  try {
    const auth = await requireSuperAdmin(request);

    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { id } = await params;
    if (!isUuid(id)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const [owner] = await db
      .select({ userId: users.id, email: users.email, isSuperAdmin: users.isSuperAdmin })
      .from(memberships)
      .innerJoin(users, eq(users.id, memberships.userId))
      .where(and(eq(memberships.tenantId, id), eq(memberships.role, "owner")))
      .limit(1);

    if (!owner || owner.isSuperAdmin) {
      return NextResponse.json({ error: "Owner not found" }, { status: 404 });
    }

    if (!(await resetTwoFactor(owner.email))) {
      return NextResponse.json({ error: "This owner has no login" }, { status: 404 });
    }

    await logAudit({
      tenantId: id,
      userId: auth.user.id,
      action: "owner_two_factor_reset",
      entity: "tenant",
      entityId: id,
    });

    await createNotification({
      tenantId: id,
      userId: owner.userId,
      type: "two_factor_reset",
      title: "Your two-factor sign-in was reset",
      message: "The platform administrator removed two-factor sign-in from your account. Sign in with your password and set it up again.",
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Reset owner two-factor error:", error);

    return NextResponse.json({ error: "Failed to reset two-factor sign-in" }, { status: 500 });
  }
}
