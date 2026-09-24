import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/authorization";
import { db } from "@/db";
import {
  employees,
  payrollRecords,
  payslips,
} from "@/db/schema";

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
      .from(payslips)
      .where(
        eq(
          payslips.tenantId,
          auth.tenant.id,
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

    // Neither lookup depends on the other's result — run them together.
    const [[employee], [payrollRecord]] = await Promise.all([
      db
        .select({
          id: employees.id,
        })
        .from(employees)
        .where(
          and(
            eq(employees.id, employeeId),
            eq(
              employees.tenantId,
              auth.tenant.id,
            ),
          ),
        )
        .limit(1),
      db
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
              auth.tenant.id,
            ),
          ),
        )
        .limit(1),
    ]);

    if (!employee) {
      return NextResponse.json(
        { error: "Employee not found" },
        { status: 404 },
      );
    }

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
        tenantId: auth.tenant.id,
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