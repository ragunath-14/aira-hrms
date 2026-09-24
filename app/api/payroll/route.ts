import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/authorization";
import { db } from "@/db";
import { employees } from "@/db/schema/employees";
import { payrollRecords } from "@/db/schema";
import { logAudit } from "@/lib/audit";
import { createNotification } from "@/lib/notifications";
import { createPayrollRecordWithRun } from "@/lib/payroll";
import { payrollCreateSchema } from "@/lib/validations";

export async function GET(request: Request) {
  try {
    const auth = await requireRole(request, [
      "owner",
      "admin",
      "hr",
    ]);

    if (!auth.authorized) {
      return NextResponse.json(
        { error: auth.error },
        { status: auth.status },
      );
    }

    const records = await db
      .select()
      .from(payrollRecords)
      .where(eq(payrollRecords.tenantId, auth.tenant.id));

    return NextResponse.json(records);
  } catch (error) {
    console.error("GET payroll records error:", error);

    return NextResponse.json(
      { error: "Failed to fetch payroll records" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireRole(request, [
      "owner",
      "admin",
      "hr",
    ]);

    if (!auth.authorized) {
      return NextResponse.json(
        { error: auth.error },
        { status: auth.status },
      );
    }

    const body = await request.json();

    const parsed = payrollCreateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const {
      employeeId,
      payrollPeriod,
      basicSalary,
      totalAllowances,
      totalDeductions,
      netSalary,
      status,
    } = parsed.data;

    const [employee] = await db
      .select({ id: employees.id, userId: employees.userId })
      .from(employees)
      .where(
        and(
          eq(employees.id, employeeId),
          eq(employees.tenantId, auth.tenant.id),
        ),
      )
      .limit(1);

    if (!employee) {
      return NextResponse.json(
        { error: "Employee not found" },
        { status: 404 },
      );
    }

    const record = await createPayrollRecordWithRun({
      tenantId: auth.tenant.id,
      employeeId,
      payrollPeriod,
      basicSalary: String(basicSalary),
      totalAllowances: String(totalAllowances ?? 0),
      totalDeductions: String(totalDeductions ?? 0),
      netSalary: String(netSalary),
      status,
    });

    await logAudit({
      tenantId: auth.tenant.id,
      userId: auth.user.id,
      action: "payroll_generated",
      entity: "payroll_record",
      entityId: record.id,
    });

    if (employee.userId) {
      await createNotification({
        tenantId: auth.tenant.id,
        userId: employee.userId,
        type: "payroll_generated",
        title: "Payslip Generated",
        message: `Your payroll for ${payrollPeriod} has been processed.`,
      });
    }

    return NextResponse.json(record, { status: 201 });
  } catch (error) {
    console.error("POST payroll record error:", error);

    return NextResponse.json(
      { error: "Failed to create payroll record" },
      { status: 500 },
    );
  }
}
