import { and, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/db";
import {
  employees,
  payslips,
} from "@/db/schema";
import { getCurrentTenant } from "@/lib/auth/authorization";

export async function GET(request: Request) {
  try {
    const context = await getCurrentTenant(request);

    if (!context) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 },
      );
    }

    const [employee] = await db
      .select()
      .from(employees)
      .where(
        and(
          eq(
            employees.userId,
            context.user.id,
          ),
          eq(
            employees.tenantId,
            context.tenant.id,
          ),
        ),
      )
      .limit(1);

    if (!employee) {
      return NextResponse.json(
        { error: "Employee record not found" },
        { status: 404 },
      );
    }

    const employeePayslips = await db
      .select()
      .from(payslips)
      .where(
        and(
          eq(
            payslips.employeeId,
            employee.id,
          ),
          eq(
            payslips.tenantId,
            context.tenant.id,
          ),
        ),
      )
      .orderBy(
        desc(payslips.generatedAt),
      );

    return NextResponse.json(
      employeePayslips,
    );
  } catch (error) {
    console.error(
      "GET employee payslips error:",
      error,
    );

    return NextResponse.json(
      {
        error:
          "Failed to fetch employee payslips",
      },
      { status: 500 },
    );
  }
}