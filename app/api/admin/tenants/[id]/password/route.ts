import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { memberships } from "@/db/schema/memberships";
import { users } from "@/db/schema/users";
import { logAudit } from "@/lib/domain/audit";
import { requireSuperAdmin } from "@/lib/auth/authorization";
import { setLoginPassword } from "@/lib/auth/credentials";
import { isUuid } from "@/lib/validation/ids";

const bodySchema = z.object({ password: z.string().min(12).max(128) });

type RouteContext = { params: Promise<{ id: string }> };

// Platform owner sets a new password for a company's owner (write-only; it is
// never readable afterwards).
export async function PUT(request: Request, { params }: RouteContext) {
  try {
    const auth = await requireSuperAdmin(request);

    if (!auth.authorized) {
      return NextResponse.json(
        { error: auth.error },
        { status: auth.status },
      );
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

    const [owner] = await db
      .select({ name: users.name, email: users.email, isSuperAdmin: users.isSuperAdmin })
      .from(memberships)
      .innerJoin(users, eq(users.id, memberships.userId))
      .where(and(eq(memberships.tenantId, id), eq(memberships.role, "owner")))
      .limit(1);

    if (!owner || owner.isSuperAdmin) {
      return NextResponse.json({ error: "Owner not found" }, { status: 404 });
    }

    await setLoginPassword({
      email: owner.email,
      name: owner.name,
      password: parsed.data.password,
    });

    await logAudit({
      tenantId: id,
      userId: auth.user.id,
      action: "owner_password_reset",
      entity: "tenant",
      entityId: id,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Owner password error:", error);

    return NextResponse.json(
      { error: "Failed to set password" },
      { status: 500 },
    );
  }
}
