import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/authorization";
import { db } from "@/db";
import { payrollRecords, payslips } from "@/db/schema";

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
    const auth = await requireRole(request, ["owner", "admin", "hr"]);

    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { payrollRecordId } = await request.json();

    if (typeof payrollRecordId !== "string") {
      return NextResponse.json(
        { error: "payrollRecordId is required" },
        { status: 400 },
      );
    }

    const [record] = await db
      .select()
      .from(payrollRecords)
      .where(
        and(
          eq(payrollRecords.id, payrollRecordId),
          eq(payrollRecords.tenantId, auth.tenant.id),
        ),
      )
      .limit(1);

    if (!record) {
      return NextResponse.json(
        { error: "Payroll record not found" },
        { status: 404 },
      );
    }

    const [already] = await db
      .select({ id: payslips.id })
      .from(payslips)
      .where(eq(payslips.payrollRecordId, record.id))
      .limit(1);

    if (already) {
      return NextResponse.json(
        { error: "A payslip already exists for this payroll record" },
        { status: 409 },
      );
    }

    // The payslip copies the stored payroll figures, never client input.
    const [payslip] = await db
      .insert(payslips)
      .values({
        tenantId: auth.tenant.id,
        employeeId: record.employeeId,
        payrollRecordId: record.id,
        payrollPeriod: record.payrollPeriod,
        basicSalary: record.basicSalary,
        totalAllowances: record.totalAllowances,
        totalDeductions: record.totalDeductions,
        netSalary: record.netSalary,
      })
      .returning();

    return NextResponse.json(payslip, { status: 201 });
  } catch (error) {
    console.error("POST payslip error:", error);

    return NextResponse.json(
      { error: "Failed to create payslip" },
      { status: 500 },
    );
  }
}
