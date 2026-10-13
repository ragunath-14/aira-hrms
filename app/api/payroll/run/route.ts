import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/db";
import { employees } from "@/db/schema/employees";
import { logAudit } from "@/lib/domain/audit";
import { requireRole } from "@/lib/auth/authorization";
import { createNotification } from "@/lib/domain/notifications";
import { generatePayrollForEmployee } from "@/lib/domain/payroll";
import { payrollRunSchema } from "@/lib/validation/schemas";

// Run payroll for every active employee for one month. Each employee is paid
// from their own salary structure; anyone already paid for that month, or with
// no structure, is skipped and reported.
export async function POST(request: Request) {
  try {
    const auth = await requireRole(request, ["owner", "admin", "hr"]);

    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const parsed = payrollRunSchema.safeParse(await request.json());

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid request" },
        { status: 400 },
      );
    }

    const { payrollPeriod } = parsed.data;

    const people = await db
      .select({ id: employees.id, userId: employees.userId })
      .from(employees)
      .where(
        and(
          eq(employees.tenantId, auth.tenant.id),
          eq(employees.status, "active"),
        ),
      );

    let created = 0;
    let alreadyPaid = 0;
    let noStructure = 0;

    for (const person of people) {
      const result = await generatePayrollForEmployee(
        auth.tenant.id,
        person.id,
        payrollPeriod,
      );

      if (result.outcome === "exists") alreadyPaid++;
      else if (result.outcome === "no_structure") noStructure++;
      else {
        created++;

        if (person.userId) {
          await createNotification({
            tenantId: auth.tenant.id,
            userId: person.userId,
            type: "payroll_generated",
            title: "Payslip Generated",
            message: `Your payroll for ${payrollPeriod} has been processed.`,
          });
        }
      }
    }

    await logAudit({
      tenantId: auth.tenant.id,
      userId: auth.user.id,
      action: "payroll_run",
      entity: "payroll_run",
      entityId: null,
    });

    return NextResponse.json({ payrollPeriod, created, alreadyPaid, noStructure });
  } catch (error) {
    console.error("Payroll run error:", error);

    return NextResponse.json(
      { error: "Failed to run payroll" },
      { status: 500 },
    );
  }
}
