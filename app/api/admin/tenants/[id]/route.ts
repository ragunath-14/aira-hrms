import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { tenants } from "@/db/schema/tenants";
import { logAudit } from "@/lib/domain/audit";
import {
  invalidateTenantContextCache,
  requireSuperAdmin,
} from "@/lib/auth/authorization";
import { isUuid } from "@/lib/validation/ids";

const decisionSchema = z.object({
  action: z.enum(["approve", "reject"]),
  note: z.string().trim().max(500).optional(),
});

type RouteContext = {
  params: Promise<{ id: string }>;
};

// Approve or reject (or later revoke) a company's access to the portal.
export async function PATCH(request: Request, { params }: RouteContext) {
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

    const parsed = decisionSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request" },
        { status: 400 },
      );
    }

    const { action, note } = parsed.data;
    const approve = action === "approve";

    const [updated] = await db
      .update(tenants)
      .set({
        accessStatus: approve ? "approved" : "rejected",
        accessReviewedAt: new Date(),
        accessReviewedBy: auth.user.id,
        accessNote: approve ? null : note || null,
        updatedAt: new Date(),
      })
      .where(eq(tenants.id, id))
      .returning({
        id: tenants.id,
        companyName: tenants.name,
        status: tenants.accessStatus,
        reviewedAt: tenants.accessReviewedAt,
        note: tenants.accessNote,
      });

    if (!updated) {
      return NextResponse.json(
        { error: "Company not found" },
        { status: 404 },
      );
    }

    // Take effect immediately instead of after the short tenant cache expires.
    invalidateTenantContextCache();

    await logAudit({
      tenantId: updated.id,
      userId: auth.user.id,
      action: approve ? "access_approved" : "access_rejected",
      entity: "tenant",
      entityId: updated.id,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PATCH access request error:", error);

    return NextResponse.json(
      { error: "Failed to update access request" },
      { status: 500 },
    );
  }
}
