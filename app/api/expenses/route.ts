import { NextResponse } from "next/server";
import { desc, eq, and, ne } from "drizzle-orm";
import { zodMessage } from "@/lib/format/error-text";

import { db } from "@/db";
import { employees, expenseClaims } from "@/db/schema";
import { logAudit } from "@/lib/domain/audit";
import { expenseCreateSchema } from "@/lib/validation/schemas";
import { getActor, invalid, serverError, unauthorized } from "@/lib/domain/workplace";

export async function GET(request: Request) {
  try {
    const actor = await getActor(request);
    if (!actor) return unauthorized();

    // The My Workspace page asks for ?mine=1 so even HR sees only their own.
    const mine = new URL(request.url).searchParams.get("mine") === "1";

    const rows = await db
      .select({
        claim: expenseClaims,
        firstName: employees.firstName,
        lastName: employees.lastName,
        employeeCode: employees.employeeCode,
      })
      .from(expenseClaims)
      .innerJoin(employees, eq(employees.id, expenseClaims.employeeId))
      .where(
        actor.isHr && !mine
          ? eq(expenseClaims.tenantId, actor.tenant.id)
          : and(
              eq(expenseClaims.tenantId, actor.tenant.id),
              eq(expenseClaims.employeeId, actor.employee.id),
            ),
      )
      .orderBy(desc(expenseClaims.createdAt))
      .limit(300);

    return NextResponse.json(
      rows.map((r) => ({
        ...r.claim,
        employeeName: [r.firstName, r.lastName].filter(Boolean).join(" "),
        employeeCode: r.employeeCode,
      })),
    );
  } catch (error) {
    return serverError("Expenses fetch", error);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await getActor(request);
    if (!actor) return unauthorized();

    const parsed = expenseCreateSchema.safeParse(await request.json());
    if (!parsed.success) return invalid(zodMessage(parsed.error));

    const [duplicate] = await db
      .select({ id: expenseClaims.id })
      .from(expenseClaims)
      .where(
        and(
          eq(expenseClaims.tenantId, actor.tenant.id),
          eq(expenseClaims.employeeId, actor.employee.id),
          eq(expenseClaims.category, parsed.data.category),
          eq(expenseClaims.amount, parsed.data.amount.toFixed(2)),
          eq(expenseClaims.expenseDate, parsed.data.expenseDate),
          ne(expenseClaims.status, "rejected"),
        ),
      )
      .limit(1);

    if (duplicate) {
      return NextResponse.json(
        { error: "An identical claim (same category, amount and date) was already submitted" },
        { status: 409 },
      );
    }

    const [created] = await db
      .insert(expenseClaims)
      .values({
        tenantId: actor.tenant.id,
        employeeId: actor.employee.id,
        category: parsed.data.category,
        amount: parsed.data.amount.toFixed(2),
        expenseDate: parsed.data.expenseDate,
        description: parsed.data.description || null,
      })
      .returning();

    await logAudit({
      tenantId: actor.tenant.id,
      userId: actor.user.id,
      action: "expense_submitted",
      entity: "expense_claim",
      entityId: created.id,
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return serverError("Expense submit", error);
  }
}
