import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { tenants } from "@/db/schema/tenants";
import { requireRole } from "@/lib/authorization";
import { logAudit } from "@/lib/audit";

export async function GET(request: Request) {
  const auth = await requireRole(request, ["owner", "admin", "hr"]);

  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  return NextResponse.json(auth.tenant.settings ?? {});
}

export async function PUT(request: Request) {
  try {
    const auth = await requireRole(request, ["owner", "admin"]);

    if (!auth.authorized) {
      return NextResponse.json(
        { error: auth.error },
        { status: auth.status },
      );
    }

    const body = await request.json();

    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return NextResponse.json(
        { error: "Settings payload must be an object" },
        { status: 400 },
      );
    }

    const [updated] = await db
      .update(tenants)
      .set({ settings: body, updatedAt: new Date() })
      .where(eq(tenants.id, auth.tenant.id))
      .returning();

    await logAudit({
      tenantId: auth.tenant.id,
      userId: auth.user.id,
      action: "system_settings_updated",
      entity: "tenant",
      entityId: auth.tenant.id,
    });

    return NextResponse.json(updated.settings);
  } catch (error) {
    console.error("PUT system settings error:", error);

    return NextResponse.json(
      { error: "Failed to update system settings" },
      { status: 500 },
    );
  }
}
