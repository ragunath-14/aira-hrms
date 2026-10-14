import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/db";
import { tenants } from "@/db/schema/tenants";
import { invalidateTenantContextCache, requireSuperAdmin } from "@/lib/auth/authorization";
import { PLAN_IDS } from "@/lib/config/plans";
import { logAudit } from "@/lib/domain/audit";
import { zodMessage } from "@/lib/format/error-text";
import { isUuid } from "@/lib/validation/ids";
import { isRealDate } from "@/lib/validation/schemas";

type Ctx = { params: Promise<{ id: string }> };

const planSchema = z
  .object({
    plan: z.enum(PLAN_IDS as [string, ...string[]], "Choose a plan from the list"),
    // null means "use the plan's own number".
    employeeLimit: z.number().int().min(1, "The people limit must be at least 1").max(100_000).nullable(),
    storageMb: z.number().int().min(1, "Storage must be at least 1 MB").max(1_048_576).nullable(),
    // YYYY-MM-DD, the last day the plan is valid; null means no expiry.
    expiresAt: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Enter the expiry as a date")
      .refine(isRealDate, "Enter a real expiry date")
      .nullable(),
  })
  .strict();

// Platform owner: set a company's plan, its limit overrides and its expiry.
// Nothing here touches the company's data.
export async function PUT(request: Request, { params }: Ctx) {
  try {
    const auth = await requireSuperAdmin(request);

    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { id } = await params;
    if (!isUuid(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

    const parsed = planSchema.safeParse(await request.json().catch(() => null));

    if (!parsed.success) {
      return NextResponse.json({ error: zodMessage(parsed.error) }, { status: 400 });
    }

    const { plan, employeeLimit, storageMb, expiresAt } = parsed.data;

    const [updated] = await db
      .update(tenants)
      .set({
        plan,
        planEmployeeLimit: employeeLimit,
        planStorageMb: storageMb,
        // The plan is valid through the whole of the chosen day.
        planExpiresAt: expiresAt ? new Date(`${expiresAt}T23:59:59Z`) : null,
        updatedAt: new Date(),
      })
      .where(eq(tenants.id, id))
      .returning({ id: tenants.id });

    if (!updated) return NextResponse.json({ error: "Company not found" }, { status: 404 });

    await logAudit({
      tenantId: id,
      userId: auth.user.id,
      action: "plan_changed",
      entity: "tenant",
      entityId: id,
    });

    // The company's own pages read the plan through the cached tenant context.
    invalidateTenantContextCache();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("PUT company plan error:", error);

    return NextResponse.json({ error: "Failed to change the plan" }, { status: 500 });
  }
}
