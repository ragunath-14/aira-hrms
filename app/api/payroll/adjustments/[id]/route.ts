import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/db";
import { payrollAdjustments, payrollRecords } from "@/db/schema";
import { requireRole } from "@/lib/auth/authorization";
import { logAudit } from "@/lib/domain/audit";
import { isUuid } from "@/lib/validation/ids";

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireRole(request, ["owner", "admin", "hr"]);

    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { id } = await params;
    if (!isUuid(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

    const [row] = await db
      .select()
      .from(payrollAdjustments)
      .where(and(eq(payrollAdjustments.id, id), eq(payrollAdjustments.tenantId, auth.tenant.id)))
      .limit(1);

    if (!row) return NextResponse.json({ error: "Adjustment not found" }, { status: 404 });

    const [paid] = await db
      .select({ id: payrollRecords.id })
      .from(payrollRecords)
      .where(
        and(
          eq(payrollRecords.tenantId, auth.tenant.id),
          eq(payrollRecords.employeeId, row.employeeId),
          eq(payrollRecords.payrollPeriod, row.payrollPeriod),
        ),
      )
      .limit(1);

    if (paid) {
      return NextResponse.json(
        { error: `Payroll for ${row.payrollPeriod} is already processed, so this adjustment can no longer be removed.` },
        { status: 409 },
      );
    }

    await db.delete(payrollAdjustments).where(eq(payrollAdjustments.id, id));

    await logAudit({
      tenantId: auth.tenant.id,
      userId: auth.user.id,
      action: "payroll_adjustment_removed",
      entity: "payroll_adjustment",
      entityId: id,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE payroll adjustment error:", error);

    return NextResponse.json({ error: "Failed to remove the adjustment" }, { status: 500 });
  }
}
