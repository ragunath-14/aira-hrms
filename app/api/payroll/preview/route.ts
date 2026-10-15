import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/db";
import { employees, payrollRecords } from "@/db/schema";
import { requireRole } from "@/lib/auth/authorization";
import { calculatePayroll } from "@/lib/domain/payroll";
import { payrollRunSchema } from "@/lib/validation/schemas";

const n = (value: string) => Number(value);

// Shows what "Run payroll" would pay for a month, person by person, without
// saving anything. Use it to check LOP days, overtime, adjustments and loan
// instalments before the month is processed.
export async function POST(request: Request) {
  try {
    const auth = await requireRole(request, ["owner", "admin", "hr"]);

    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const parsed = payrollRunSchema.safeParse(await request.json().catch(() => null));

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid request" },
        { status: 400 },
      );
    }

    const { payrollPeriod } = parsed.data;

    const people = await db
      .select({
        id: employees.id,
        firstName: employees.firstName,
        lastName: employees.lastName,
        code: employees.employeeCode,
      })
      .from(employees)
      .where(and(eq(employees.tenantId, auth.tenant.id), eq(employees.status, "active")));

    const paid = await db
      .select({ employeeId: payrollRecords.employeeId, net: payrollRecords.netSalary })
      .from(payrollRecords)
      .where(and(eq(payrollRecords.tenantId, auth.tenant.id), eq(payrollRecords.payrollPeriod, payrollPeriod)));
    const paidNet = new Map(paid.map((row) => [row.employeeId, row.net]));

    const rows: unknown[] = [];

    // A few people at a time: each one needs several lookups.
    for (let i = 0; i < people.length; i += 5) {
      const batch = people.slice(i, i + 5);

      const results = await Promise.all(
        batch.map(async (person) => {
          const name = [person.firstName, person.lastName].filter(Boolean).join(" ");
          const base = { employeeId: person.id, name, code: person.code };

          if (paidNet.has(person.id)) {
            return { ...base, status: "paid" as const, net: n(paidNet.get(person.id) ?? "0") };
          }

          const figures = await calculatePayroll(auth.tenant.id, person.id, payrollPeriod);

          if (!figures) return { ...base, status: "no_structure" as const };

          const statutory =
            n(figures.pfEmployee) + n(figures.esiEmployee) + n(figures.professionalTax) + n(figures.tds) + n(figures.lwfEmployee);

          return {
            ...base,
            status: "ready" as const,
            basic: n(figures.basicSalary),
            otherEarnings: n(figures.totalAllowances),
            gross: n(figures.basicSalary) + n(figures.totalAllowances),
            paidDays: n(figures.paidDays),
            lopDays: n(figures.lopDays),
            daysInPeriod: figures.daysInPeriod,
            overtimeHours: n(figures.overtimeHours),
            overtimePay: n(figures.overtimePay),
            adjustmentEarnings: n(figures.adjustmentEarnings),
            adjustmentDeductions: n(figures.adjustmentDeductions),
            loanDeduction: n(figures.loanDeduction),
            statutory,
            totalDeductions: n(figures.totalDeductions),
            net: n(figures.netSalary),
          };
        }),
      );

      rows.push(...results);
    }

    return NextResponse.json({ payrollPeriod, rows });
  } catch (error) {
    console.error("Payroll preview error:", error);

    return NextResponse.json({ error: "Failed to preview payroll" }, { status: 500 });
  }
}
