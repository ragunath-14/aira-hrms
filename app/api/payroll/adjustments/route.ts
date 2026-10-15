import { and, desc, eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/db";
import { employees, payrollAdjustments, payrollRecords } from "@/db/schema";
import { requireRole } from "@/lib/auth/authorization";
import { logAudit } from "@/lib/domain/audit";
import { PAYROLL_PERIOD_PATTERN } from "@/lib/domain/payroll";
import { zodMessage } from "@/lib/format/error-text";

const createSchema = z
  .object({
    employeeIds: z.array(z.string().uuid("Choose valid employees")).min(1, "Choose at least one employee").max(500),
    payrollPeriod: z.string().regex(PAYROLL_PERIOD_PATTERN, "Choose a month, written as YYYY-MM"),
    kind: z.enum(["earning", "deduction"], "Choose bonus/arrears or a deduction"),
    label: z.string().trim().min(1, "Enter a label, such as Diwali bonus").max(80),
    amount: z.number().positive("The amount must be more than 0").max(100_000_000),
  })
  .strict();

// Adjustments for a month: every one-off bonus, arrears payment or recovery
// that will be applied when that month's payroll runs.
export async function GET(request: Request) {
  try {
    const auth = await requireRole(request, ["owner", "admin", "hr"]);

    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const period = new URL(request.url).searchParams.get("period") ?? "";

    if (!PAYROLL_PERIOD_PATTERN.test(period)) {
      return NextResponse.json({ error: "Choose a month, written as YYYY-MM" }, { status: 400 });
    }

    const rows = await db
      .select({
        id: payrollAdjustments.id,
        employeeId: payrollAdjustments.employeeId,
        firstName: employees.firstName,
        lastName: employees.lastName,
        code: employees.employeeCode,
        payrollPeriod: payrollAdjustments.payrollPeriod,
        kind: payrollAdjustments.kind,
        label: payrollAdjustments.label,
        amount: payrollAdjustments.amount,
        createdAt: payrollAdjustments.createdAt,
      })
      .from(payrollAdjustments)
      .innerJoin(employees, eq(employees.id, payrollAdjustments.employeeId))
      .where(and(eq(payrollAdjustments.tenantId, auth.tenant.id), eq(payrollAdjustments.payrollPeriod, period)))
      .orderBy(desc(payrollAdjustments.createdAt));

    const processed = await db
      .select({ employeeId: payrollRecords.employeeId })
      .from(payrollRecords)
      .where(and(eq(payrollRecords.tenantId, auth.tenant.id), eq(payrollRecords.payrollPeriod, period)));
    const locked = new Set(processed.map((row) => row.employeeId));

    return NextResponse.json(
      rows.map((row) => ({
        id: row.id,
        employeeId: row.employeeId,
        employee: [row.firstName, row.lastName].filter(Boolean).join(" "),
        code: row.code,
        payrollPeriod: row.payrollPeriod,
        kind: row.kind,
        label: row.label,
        amount: row.amount,
        // Once the month is processed for that person, it can no longer change.
        locked: locked.has(row.employeeId),
      })),
    );
  } catch (error) {
    console.error("GET payroll adjustments error:", error);

    return NextResponse.json({ error: "Failed to load adjustments" }, { status: 500 });
  }
}

// Add the same adjustment for one or many employees.
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

    const { employeeIds, payrollPeriod, kind, label, amount } = parsed.data;
    const unique = [...new Set(employeeIds)];

    const people = await db
      .select({ id: employees.id, firstName: employees.firstName, lastName: employees.lastName })
      .from(employees)
      .where(and(eq(employees.tenantId, auth.tenant.id), inArray(employees.id, unique)));

    if (people.length !== unique.length) {
      return NextResponse.json({ error: "One of those employees was not found" }, { status: 404 });
    }

    // A month already paid is final: nothing can be added to it.
    const paid = await db
      .select({ employeeId: payrollRecords.employeeId })
      .from(payrollRecords)
      .where(
        and(
          eq(payrollRecords.tenantId, auth.tenant.id),
          eq(payrollRecords.payrollPeriod, payrollPeriod),
          inArray(payrollRecords.employeeId, unique),
        ),
      );

    if (paid.length > 0) {
      const names = people
        .filter((p) => paid.some((r) => r.employeeId === p.id))
        .slice(0, 3)
        .map((p) => [p.firstName, p.lastName].filter(Boolean).join(" "));

      return NextResponse.json(
        {
          error: `Payroll for ${payrollPeriod} is already processed for ${names.join(", ")}${
            paid.length > 3 ? ` and ${paid.length - 3} more` : ""
          }, so it can no longer change. Delete that payroll record first, or use the next month.`,
        },
        { status: 409 },
      );
    }

    await db.insert(payrollAdjustments).values(
      unique.map((employeeId) => ({
        tenantId: auth.tenant.id,
        employeeId,
        payrollPeriod,
        kind,
        label,
        amount: amount.toFixed(2),
        createdBy: auth.user.id,
      })),
    );

    await logAudit({
      tenantId: auth.tenant.id,
      userId: auth.user.id,
      action: "payroll_adjustment_added",
      entity: "payroll_adjustment",
      entityId: null,
    });

    return NextResponse.json({ created: unique.length }, { status: 201 });
  } catch (error) {
    console.error("POST payroll adjustments error:", error);

    return NextResponse.json({ error: "Failed to add the adjustment" }, { status: 500 });
  }
}
