import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/db";
import { tenants } from "@/db/schema/tenants";
import { invalidateTenantContextCache, requireRole } from "@/lib/auth/authorization";
import { PT_PRESETS, resolveStatutory } from "@/lib/config/statutory";
import { logAudit } from "@/lib/domain/audit";
import { zodMessage } from "@/lib/format/error-text";
import { statutoryConfigSchema } from "@/lib/validation/schemas";

export async function GET(request: Request) {
  const auth = await requireRole(request, ["owner", "admin", "hr"]);

  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  return NextResponse.json({
    config: resolveStatutory(auth.tenant.settings),
    ptPresets: PT_PRESETS,
  });
}

// Payroll rules change every employee's take-home pay, so only owner/admin may
// change them, and every change is audited.
export async function PUT(request: Request) {
  try {
    const auth = await requireRole(request, ["owner", "admin"]);

    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const parsed = statutoryConfigSchema.safeParse(await request.json());

    if (!parsed.success) {
      return NextResponse.json({ error: zodMessage(parsed.error) }, { status: 400 });
    }

    const [updated] = await db
      .update(tenants)
      .set({
        settings: { ...(auth.tenant.settings ?? {}), statutory: parsed.data },
        updatedAt: new Date(),
      })
      .where(eq(tenants.id, auth.tenant.id))
      .returning();

    await logAudit({
      tenantId: auth.tenant.id,
      userId: auth.user.id,
      action: "statutory_settings_updated",
      entity: "tenant",
      entityId: auth.tenant.id,
    });

    invalidateTenantContextCache();

    return NextResponse.json({ config: resolveStatutory(updated.settings) });
  } catch (error) {
    console.error("PUT statutory settings error:", error);

    return NextResponse.json({ error: "Failed to save payroll compliance settings" }, { status: 500 });
  }
}
