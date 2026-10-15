import { and, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/db";
import { employees, loans } from "@/db/schema";
import { requireRole } from "@/lib/auth/authorization";
import { logAudit } from "@/lib/domain/audit";
import { createNotification } from "@/lib/domain/notifications";
import { PAYROLL_PERIOD_PATTERN } from "@/lib/domain/payroll";
import { zodMessage } from "@/lib/format/error-text";

const createSchema = z
  .object({
    employeeId: z.string().uuid("Choose an employee"),
    kind: z.enum(["loan", "advance"]).default("advance"),
    principal: z.number().positive("The amount must be more than 0").max(10_000_000),
    installments: z.number().int().min(1, "Choose at least 1 instalment").max(120, "At most 120 instalments"),
    startPeriod: z.string().regex(PAYROLL_PERIOD_PATTERN, "Choose the first month to recover from"),
    note: z.string().trim().max(200).nullable().optional(),
  })
  .strict();

export async function GET(request: Request) {
  try {
    const auth = await requireRole(request, ["owner", "admin", "hr"]);

    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const rows = await db
      .select({
        loan: loans,
        firstName: employees.firstName,
        lastName: employees.lastName,
        code: employees.employeeCode,
      })
      .from(loans)
      .innerJoin(employees, eq(employees.id, loans.employeeId))
      .where(eq(loans.tenantId, auth.tenant.id))
      .orderBy(desc(loans.createdAt));

    return NextResponse.json(
      rows.map(({ loan, firstName, lastName, code }) => ({
        id: loan.id,
        employeeId: loan.employeeId,
        employee: [firstName, lastName].filter(Boolean).join(" "),
        code,
        kind: loan.kind,
        principal: loan.principal,
        installments: loan.installments,
        installmentAmount: loan.installmentAmount,
        startPeriod: loan.startPeriod,
        balance: loan.balance,
        status: loan.status,
        note: loan.note,
        createdAt: loan.createdAt,
      })),
    );
  } catch (error) {
    console.error("GET loans error:", error);

    return NextResponse.json({ error: "Failed to load loans" }, { status: 500 });
  }
}

// Record a loan or salary advance. Payroll recovers it in equal monthly
// instalments from the chosen month until the balance is zero.
export async function POST(request: Request) {
  try {
    const auth = await requireRole(request, ["owner", "admin", "hr"]);

    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const parsed = createSchema.safeParse(await request.json().catch(() => null));

    if (!parsed.success) {
      return NextResponse.json({ error: zodMessage(parsed.error) }, { status: 400 });
    }

    const { employeeId, kind, principal, installments, startPeriod, note } = parsed.data;

    const [person] = await db
      .select({ id: employees.id, userId: employees.userId })
      .from(employees)
      .where(and(eq(employees.id, employeeId), eq(employees.tenantId, auth.tenant.id)))
      .limit(1);

    if (!person) return NextResponse.json({ error: "Employee not found" }, { status: 404 });

    const installmentAmount = Math.ceil((principal / installments) * 100) / 100;

    const [created] = await db
      .insert(loans)
      .values({
        tenantId: auth.tenant.id,
        employeeId,
        kind,
        principal: principal.toFixed(2),
        installments,
        installmentAmount: installmentAmount.toFixed(2),
        startPeriod,
        balance: principal.toFixed(2),
        note: note || null,
        createdBy: auth.user.id,
      })
      .returning();

    await logAudit({
      tenantId: auth.tenant.id,
      userId: auth.user.id,
      action: "loan_created",
      entity: "loan",
      entityId: created.id,
    });

    if (person.userId && person.userId !== auth.user.id) {
      await createNotification({
        tenantId: auth.tenant.id,
        userId: person.userId,
        type: "loan_added",
        title: kind === "loan" ? "A loan was recorded" : "An advance was recorded",
        message: `₹${principal.toLocaleString("en-IN")} will be recovered in ${installments} monthly instalment${installments === 1 ? "" : "s"} of ₹${installmentAmount.toLocaleString("en-IN")} from ${startPeriod}.`,
        link: "/employee/loans",
      });
    }

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error("POST loan error:", error);

    return NextResponse.json({ error: "Failed to record the loan" }, { status: 500 });
  }
}
