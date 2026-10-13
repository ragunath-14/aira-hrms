import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { payslips } from "@/db/schema";
import { requireRole } from "@/lib/auth/authorization";
import { logAudit } from "@/lib/domain/audit";
import { isUuid } from "@/lib/validation/ids";

// Removes a payslip only; the payroll record it came from stays.
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireRole(request, ["owner", "admin", "hr"]);

    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { id } = await params;
    if (!isUuid(id)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const [deleted] = await db
      .delete(payslips)
      .where(and(eq(payslips.id, id), eq(payslips.tenantId, auth.tenant.id)))
      .returning({ id: payslips.id });

    if (!deleted) {
      return NextResponse.json({ error: "Payslip not found" }, { status: 404 });
    }

    await logAudit({
      tenantId: auth.tenant.id,
      userId: auth.user.id,
      action: "payslip_deleted",
      entity: "payslip",
      entityId: id,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Payslip DELETE error:", error);
    return NextResponse.json({ error: "Failed to delete payslip" }, { status: 500 });
  }
}
