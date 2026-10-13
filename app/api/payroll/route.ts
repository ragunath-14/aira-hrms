import { and, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/authorization";
import { db } from "@/db";
import { employees } from "@/db/schema/employees";
import { payrollRecords } from "@/db/schema";
import { logAudit } from "@/lib/domain/audit";
import { createNotification } from "@/lib/domain/notifications";
import { generatePayrollForEmployee } from "@/lib/domain/payroll";
import { payrollCreateSchema } from "@/lib/validation/schemas";

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
      .select({
        id: payrollRecords.id,
        employeeId: payrollRecords.employeeId,
        employeeName: sql<string>`trim(${employees.firstName} || ' ' || coalesce(${employees.lastName}, ''))`,
        employeeCode: employees.employeeCode,
        payrollPeriod: payrollRecords.payrollPeriod,
        basicSalary: payrollRecords.basicSalary,
        totalAllowances: payrollRecords.totalAllowances,
        totalDeductions: payrollRecords.totalDeductions,
        netSalary: payrollRecords.netSalary,
        status: payrollRecords.status,
        createdAt: payrollRecords.createdAt,
      })
      .from(payrollRecords)
      .leftJoin(employees, eq(payrollRecords.employeeId, employees.id))
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
    const auth = await requireRole(request, ["owner", "admin", "hr"]);

    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const parsed = payrollCreateSchema.safeParse(await request.json());

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid request" },
        { status: 400 },
      );
    }

    const { employeeId, payrollPeriod } = parsed.data;

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
      return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    }

    const result = await generatePayrollForEmployee(
      auth.tenant.id,
      employeeId,
      payrollPeriod,
    );

    if (result.outcome === "exists") {
      return NextResponse.json(
        { error: `Payroll for ${payrollPeriod} already exists for this employee` },
        { status: 409 },
      );
    }

    if (result.outcome === "no_structure") {
      return NextResponse.json(
        { error: "This employee has no active salary structure for that month" },
        { status: 422 },
      );
    }

    await logAudit({
      tenantId: auth.tenant.id,
      userId: auth.user.id,
      action: "payroll_generated",
      entity: "payroll_record",
      entityId: result.recordId,
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

    return NextResponse.json(
      { id: result.recordId, netSalary: result.netSalary },
      { status: 201 },
    );
  } catch (error) {
    console.error("POST payroll record error:", error);

    return NextResponse.json(
      { error: "Failed to create payroll record" },
      { status: 500 },
    );
  }
}
