import { and, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/db";
import { loanRepayments, loans } from "@/db/schema";
import { requireRole } from "@/lib/auth/authorization";
import { logAudit } from "@/lib/domain/audit";
import { isUuid } from "@/lib/validation/ids";

type Ctx = { params: Promise<{ id: string }> };

// Stop recovering a loan early (written off, or paid back in cash). What was
// already recovered stays recorded.
export async function PATCH(request: Request, { params }: Ctx) {
  try {
    const auth = await requireRole(request, ["owner", "admin", "hr"]);

    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { id } = await params;
    if (!isUuid(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

    const parsed = z.object({ action: z.literal("close") }).strict().safeParse(await request.json().catch(() => null));

    if (!parsed.success) return NextResponse.json({ error: "Nothing to change" }, { status: 400 });

    const [updated] = await db
      .update(loans)
      .set({ status: "closed", updatedAt: new Date() })
      .where(and(eq(loans.id, id), eq(loans.tenantId, auth.tenant.id)))
      .returning({ id: loans.id });

    if (!updated) return NextResponse.json({ error: "Loan not found" }, { status: 404 });

    await logAudit({
      tenantId: auth.tenant.id,
      userId: auth.user.id,
      action: "loan_closed",
      entity: "loan",
      entityId: id,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("PATCH loan error:", error);

    return NextResponse.json({ error: "Failed to update the loan" }, { status: 500 });
  }
}

// Remove a loan entered by mistake. Once any instalment has been taken it is
// part of a payslip, so it can only be closed.
export async function DELETE(request: Request, { params }: Ctx) {
  try {
    const auth = await requireRole(request, ["owner", "admin", "hr"]);

    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { id } = await params;
    if (!isUuid(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

    const [loan] = await db
      .select({ id: loans.id })
      .from(loans)
      .where(and(eq(loans.id, id), eq(loans.tenantId, auth.tenant.id)))
      .limit(1);

    if (!loan) return NextResponse.json({ error: "Loan not found" }, { status: 404 });

    const [taken] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(loanRepayments)
      .where(eq(loanRepayments.loanId, id));

    if ((taken?.n ?? 0) > 0) {
      return NextResponse.json(
        { error: "Instalments have already been taken from payslips, so this loan can only be closed, not deleted." },
        { status: 409 },
      );
    }

    await db.delete(loans).where(eq(loans.id, id));

    await logAudit({
      tenantId: auth.tenant.id,
      userId: auth.user.id,
      action: "loan_deleted",
      entity: "loan",
      entityId: id,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE loan error:", error);

    return NextResponse.json({ error: "Failed to delete the loan" }, { status: 500 });
  }
}
