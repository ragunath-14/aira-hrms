import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { employees, expenseClaims } from "@/db/schema";
import { logAudit } from "@/lib/domain/audit";
import { isUuid } from "@/lib/validation/ids";
import { createNotification } from "@/lib/domain/notifications";
import { formatINR } from "@/lib/format/currency";
import { expenseReviewSchema } from "@/lib/validation/schemas";
import {
  forbidden,
  getActor,
  invalid,
  notFound,
  serverError,
  unauthorized,
} from "@/lib/domain/workplace";

type Ctx = { params: Promise<{ id: string }> };

async function loadClaim(id: string, tenantId: string) {
  const [claim] = await db
    .select()
    .from(expenseClaims)
    .where(and(eq(expenseClaims.id, id), eq(expenseClaims.tenantId, tenantId)))
    .limit(1);
  return claim;
}

// HR reviews a claim: pending -> approved | rejected, approved -> paid.
export async function PATCH(request: Request, { params }: Ctx) {
  try {
    const actor = await getActor(request);
    if (!actor) return unauthorized();
    if (!actor.isHr) return forbidden();

    const { id } = await params;
    if (!isUuid(id)) return invalid("Invalid id");

    const parsed = expenseReviewSchema.safeParse(await request.json());
    if (!parsed.success) return invalid(parsed.error.flatten());

    const claim = await loadClaim(id, actor.tenant.id);
    if (!claim) return notFound("Expense claim");

    // Nobody approves their own claim.
    if (claim.employeeId === actor.employee.id) {
      return NextResponse.json(
        { error: "You cannot review your own expense claim" },
        { status: 403 },
      );
    }

    const next = parsed.data.status;
    const allowed =
      (claim.status === "pending" && (next === "approved" || next === "rejected")) ||
      (claim.status === "approved" && next === "paid");

    if (!allowed) {
      return NextResponse.json(
        { error: `A ${claim.status} claim cannot be marked ${next}` },
        { status: 409 },
      );
    }

    const [updated] = await db
      .update(expenseClaims)
      .set({
        status: next,
        reviewedBy: actor.user.id,
        reviewNote: parsed.data.reviewNote || claim.reviewNote,
      })
      .where(eq(expenseClaims.id, id))
      .returning();

    const [owner] = await db
      .select({ userId: employees.userId })
      .from(employees)
      .where(eq(employees.id, claim.employeeId))
      .limit(1);

    if (owner?.userId) {
      await createNotification({
        tenantId: actor.tenant.id,
        userId: owner.userId,
        type: "expense_reviewed",
        title: `Expense claim ${next}`,
        message: `Your ${claim.category} claim of ${formatINR(claim.amount)} was ${next}.`,
      });
    }

    await logAudit({
      tenantId: actor.tenant.id,
      userId: actor.user.id,
      action: `expense_${next}`,
      entity: "expense_claim",
      entityId: id,
    });

    return NextResponse.json(updated);
  } catch (error) {
    return serverError("Expense review", error);
  }
}

// An employee withdraws their own claim while it is still pending. HR can
// delete any claim in the company (for example a duplicate or a test entry).
export async function DELETE(request: Request, { params }: Ctx) {
  try {
    const actor = await getActor(request);
    if (!actor) return unauthorized();

    const { id } = await params;
    if (!isUuid(id)) return invalid("Invalid id");

    const claim = await loadClaim(id, actor.tenant.id);

    if (!claim || (!actor.isHr && claim.employeeId !== actor.employee.id)) {
      return notFound("Expense claim");
    }

    if (!actor.isHr && claim.status !== "pending") {
      return NextResponse.json(
        { error: "Only pending claims can be withdrawn" },
        { status: 409 },
      );
    }

    await db.delete(expenseClaims).where(eq(expenseClaims.id, id));

    await logAudit({
      tenantId: actor.tenant.id,
      userId: actor.user.id,
      action: actor.isHr ? "expense_deleted" : "expense_withdrawn",
      entity: "expense_claim",
      entityId: id,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return serverError("Expense delete", error);
  }
}
