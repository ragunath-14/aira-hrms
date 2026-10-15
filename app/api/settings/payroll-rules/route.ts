import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/db";
import { tenants } from "@/db/schema/tenants";
import { invalidateTenantContextCache, requireRole } from "@/lib/auth/authorization";
import { resolvePayrollRules } from "@/lib/config/payroll-rules";
import { logAudit } from "@/lib/domain/audit";
import { zodMessage } from "@/lib/format/error-text";
import { payrollRulesSchema } from "@/lib/validation/schemas";

export async function GET(request: Request) {
  const auth = await requireRole(request, ["owner", "admin", "hr"]);

  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  return NextResponse.json({ rules: resolvePayrollRules(auth.tenant.settings) });
}

// These rules change what every employee is paid, so only owner and admin may
// change them, and every change is audited.
export async function PUT(request: Request) {
  try {
    const auth = await requireRole(request, ["owner", "admin"]);

    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const parsed = payrollRulesSchema.safeParse(await request.json().catch(() => null));

    if (!parsed.success) {
      return NextResponse.json({ error: zodMessage(parsed.error) }, { status: 400 });
    }

    const [updated] = await db
      .update(tenants)
      .set({
        settings: { ...(auth.tenant.settings ?? {}), payrollRules: parsed.data },
        updatedAt: new Date(),
      })
      .where(eq(tenants.id, auth.tenant.id))
      .returning();

    await logAudit({
      tenantId: auth.tenant.id,
      userId: auth.user.id,
      action: "payroll_rules_updated",
      entity: "tenant",
      entityId: auth.tenant.id,
    });

    invalidateTenantContextCache();

    return NextResponse.json({ rules: resolvePayrollRules(updated.settings) });
  } catch (error) {
    console.error("PUT payroll rules error:", error);

    return NextResponse.json({ error: "Failed to save payroll rules" }, { status: 500 });
  }
}
