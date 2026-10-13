import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { tenants } from "@/db/schema/tenants";
import { invalidateTenantContextCache, requireRole } from "@/lib/auth/authorization";
import { zodMessage } from "@/lib/format/error-text";
import { resolveSettings } from "@/lib/config/settings";
import { logAudit } from "@/lib/domain/audit";
import { systemSettingsUpdateSchema } from "@/lib/validation/schemas";

export async function GET(request: Request) {
  const auth = await requireRole(request, ["owner", "admin", "hr"]);

  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  return NextResponse.json(resolveSettings(auth.tenant.settings));
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

    const parsed = systemSettingsUpdateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: zodMessage(parsed.error) },
        { status: 400 },
      );
    }

    const [updated] = await db
      .update(tenants)
      .set({
        settings: { ...(auth.tenant.settings ?? {}), ...parsed.data },
        updatedAt: new Date(),
      })
      .where(eq(tenants.id, auth.tenant.id))
      .returning();

    await logAudit({
      tenantId: auth.tenant.id,
      userId: auth.user.id,
      action: "system_settings_updated",
      entity: "tenant",
      entityId: auth.tenant.id,
    });

    invalidateTenantContextCache();

    return NextResponse.json(resolveSettings(updated.settings));
  } catch (error) {
    console.error("PUT system settings error:", error);

    return NextResponse.json(
      { error: "Failed to update system settings" },
      { status: 500 },
    );
  }
}
