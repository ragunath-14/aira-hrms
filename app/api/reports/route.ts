import { and, count, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/db";
import {
  employees,
  leaveRequests,
  payrollRecords,
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

    const tenantId = context.tenant.id;

    const [employeesTotal] = await db
      .select({ count: count() })
      .from(employees)
      .where(eq(employees.tenantId, tenantId));

    const [activeEmployees] = await db
      .select({ count: count() })
      .from(employees)
      .where(
        and(
          eq(employees.tenantId, tenantId),
          eq(employees.status, "active"),
        ),
      );

    const [pendingLeaves] = await db
      .select({ count: count() })
      .from(leaveRequests)
      .where(
        and(
          eq(leaveRequests.tenantId, tenantId),
          eq(leaveRequests.status, "pending"),
        ),
      );

    const [approvedLeaves] = await db
      .select({ count: count() })
      .from(leaveRequests)
      .where(
        and(
          eq(leaveRequests.tenantId, tenantId),
          eq(leaveRequests.status, "approved"),
        ),
      );

    const [rejectedLeaves] = await db
      .select({ count: count() })
      .from(leaveRequests)
      .where(
        and(
          eq(leaveRequests.tenantId, tenantId),
          eq(leaveRequests.status, "rejected"),
        ),
      );

    const [payrollRecordsTotal] = await db
      .select({ count: count() })
      .from(payrollRecords)
      .where(eq(payrollRecords.tenantId, tenantId));

    return NextResponse.json({
      employees: {
        total: employeesTotal.count,
        active: activeEmployees.count,
      },
      leaveRequests: {
        pending: pendingLeaves.count,
        approved: approvedLeaves.count,
        rejected: rejectedLeaves.count,
      },
      payroll: {
        totalRecords: payrollRecordsTotal.count,
      },
    });
  } catch (error) {
    console.error("GET reports error:", error);

    return NextResponse.json(
      { error: "Failed to generate report" },
      { status: 500 },
    );
  }
}