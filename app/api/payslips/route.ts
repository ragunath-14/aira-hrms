import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/authorization";
import { db } from "@/db";
import {
  employees,
  payrollRecords,
  payslips,
} from "@/db/schema";
import { getCurrentTenant } from "@/lib/authorization";

export async function GET(request: Request) {
  try {
    const context = await getCurrentTenant(request);

    if (!context) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 },
      );
    }
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
      .from(payslips)
      .where(
        eq(
          payslips.tenantId,
          context.tenant.id,
        ),
      );

    return NextResponse.json(records);
  } catch (error) {
    console.error("GET payslips error:", error);

    return NextResponse.json(
      { error: "Failed to fetch payslips" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const context = await getCurrentTenant(request);

    if (!context) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 },
      );
    }
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

    const {
      employeeId,
      payrollRecordId,
      payrollPeriod,
      basicSalary,
      totalAllowances,
      totalDeductions,
      netSalary,
    } = body;

    if (
      !employeeId ||
      !payrollRecordId ||
      !payrollPeriod ||
      basicSalary === undefined ||
      netSalary === undefined
    ) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    const [employee] = await db
      .select({
        id: employees.id,
      })
      .from(employees)
      .where(
        and(
          eq(employees.id, employeeId),
          eq(
            employees.tenantId,
            context.tenant.id,
          ),
        ),
      )
      .limit(1);

    if (!employee) {
      return NextResponse.json(
        { error: "Employee not found" },
        { status: 404 },
      );
    }

    const [payrollRecord] = await db
      .select({
        id: payrollRecords.id,
        employeeId: payrollRecords.employeeId,
      })
      .from(payrollRecords)
      .where(
        and(
          eq(
            payrollRecords.id,
            payrollRecordId,
          ),
          eq(
            payrollRecords.tenantId,
            context.tenant.id,
          ),
        ),
      )
      .limit(1);

    if (!payrollRecord) {
      return NextResponse.json(
        { error: "Payroll record not found" },
        { status: 404 },
      );
    }

    if (
      payrollRecord.employeeId !== employee.id
    ) {
      return NextResponse.json(
        {
          error:
            "Payroll record does not belong to employee",
        },
        { status: 400 },
      );
    }

    const [payslip] = await db
      .insert(payslips)
      .values({
        tenantId: context.tenant.id,
        employeeId,
        payrollRecordId,
        payrollPeriod,
        basicSalary: String(basicSalary),
        totalAllowances: String(
          totalAllowances ?? 0,
        ),
        totalDeductions: String(
          totalDeductions ?? 0,
        ),
        netSalary: String(netSalary),
      })
      .returning();

    return NextResponse.json(payslip, {
      status: 201,
    });
  } catch (error) {
    console.error("POST payslip error:", error);

    return NextResponse.json(
      { error: "Failed to create payslip" },
      { status: 500 },
    );
  }
}