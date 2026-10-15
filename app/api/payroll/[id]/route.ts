import { NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { loanRepayments, loans, payrollItems, payrollRecords, payrollRuns } from "@/db/schema";
import { requireRole } from "@/lib/auth/authorization";
import { logAudit } from "@/lib/domain/audit";
import { isUuid } from "@/lib/validation/ids";

// Deletes one payroll record together with its payslip and run line (they are
// removed by the database cascade). A run left with no records is removed too.
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

    const [record] = await db
      .select()
      .from(payrollRecords)
      .where(and(eq(payrollRecords.id, id), eq(payrollRecords.tenantId, auth.tenant.id)))
      .limit(1);

    if (!record) {
      return NextResponse.json({ error: "Payroll record not found" }, { status: 404 });
    }

    const items = await db
      .select({ runId: payrollItems.payrollRunId })
      .from(payrollItems)
      .where(eq(payrollItems.payrollRecordId, id));

    // Loan instalments taken in this payslip go back onto the loan.
    const repaid = await db
      .select({ loanId: loanRepayments.loanId, amount: loanRepayments.amount })
      .from(loanRepayments)
      .where(eq(loanRepayments.payrollRecordId, id));

    for (const row of repaid) {
      await db
        .update(loans)
        .set({
          balance: sql`${loans.balance} + ${row.amount}::numeric`,
          status: "active",
          updatedAt: new Date(),
        })
        .where(eq(loans.id, row.loanId));
    }

    await db.delete(payrollRecords).where(eq(payrollRecords.id, id));

    for (const runId of new Set(items.map((i) => i.runId))) {
      const [left] = await db
        .select({ n: sql<number>`count(*)::int` })
        .from(payrollItems)
        .where(eq(payrollItems.payrollRunId, runId));

      if (left.n === 0) {
        await db
          .delete(payrollRuns)
          .where(and(eq(payrollRuns.id, runId), eq(payrollRuns.tenantId, auth.tenant.id)));
      }
    }

    await logAudit({
      tenantId: auth.tenant.id,
      userId: auth.user.id,
      action: "payroll_record_deleted",
      entity: "payroll_record",
      entityId: id,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Payroll DELETE error:", error);
    return NextResponse.json({ error: "Failed to delete payroll record" }, { status: 500 });
  }
}
