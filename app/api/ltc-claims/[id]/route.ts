import { isUuid } from "@/lib/ids";
import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { employees, ltcClaims, notifications } from "@/db/schema";
import { requireRole } from "@/lib/authorization";
import { logAudit } from "@/lib/audit";
import { approvalActionSchema } from "@/lib/validations";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireRole(request, [
      "owner",
      "admin",
      "hr",
      "manager",
    ]);

    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { id } = await params;
    if (!isUuid(id)) {
      return Response.json({ error: "Invalid id" }, { status: 400 });
    }
    const body = await request.json();
    const parsed = approvalActionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { action, comment } = parsed.data;

    const [claim] = await db
      .select()
      .from(ltcClaims)
      .where(and(eq(ltcClaims.id, id), eq(ltcClaims.tenantId, auth.tenant.id)))
      .limit(1);

    if (!claim) {
      return NextResponse.json(
        { error: "LTC claim not found" },
        { status: 404 },
      );
    }

    if (claim.status !== "pending") {
      return NextResponse.json(
        { error: "Only pending claims can be processed" },
        { status: 409 },
      );
    }

    // The employee lookup and the status update are independent of
    // each other — run them together instead of one-after-another.
    const [[employee], [updated]] = await Promise.all([
      db
        .select({ userId: employees.userId })
        .from(employees)
        .where(and(eq(employees.id, claim.employeeId), eq(employees.tenantId, auth.tenant.id)))
        .limit(1),
      db
        .update(ltcClaims)
        .set({
          status: action === "approve" ? "approved" : "rejected",
          managerComment: comment || null,
          updatedAt: new Date(),
        })
        .where(and(eq(ltcClaims.id, id), eq(ltcClaims.tenantId, auth.tenant.id)))
        .returning(),
    ]);

    await Promise.all([
      employee?.userId
        ? db.insert(notifications).values({
            tenantId: auth.tenant.id,
            userId: employee.userId,
            type: `ltc_claim_${action === "approve" ? "approved" : "rejected"}`,
            title: `LTC Claim ${action === "approve" ? "Approved" : "Rejected"}`,
            message: `Your LTC claim for block year ${claim.blockYear} was ${action === "approve" ? "approved" : "rejected"}.${comment ? ` Comment: ${comment}` : ""}`,
            isRead: false,
          })
        : Promise.resolve(),
      logAudit({
        tenantId: auth.tenant.id,
        userId: auth.user.id,
        action: `ltc_claim_${action}d`,
        entity: "ltc_claim",
        entityId: id,
      }),
    ]);

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PATCH LTC claim error:", error);

    return NextResponse.json(
      { error: "Failed to process LTC claim" },
      { status: 500 },
    );
  }
}
