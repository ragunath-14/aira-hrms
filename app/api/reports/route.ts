import { and, count, eq, gte, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/db";
import {
  attendance,
  departments,
  employees,
  leaveRequests,
  payrollRecords,
} from "@/db/schema";
import { requireRole } from "@/lib/auth/authorization";

export async function GET(request: Request) {
  try {
    const auth = await requireRole(request, [
      "owner",
      "admin",
      "hr",
      "manager",
    ]);

    if (!auth.authorized) {
      return NextResponse.json(
        { error: auth.error },
        { status: auth.status },
      );
    }

    const tenantId = auth.tenant.id;

    // Payroll totals are compensation data: the payroll APIs are limited
    // to owner/admin/hr, so managers get the rest of the dashboard without
    // company-wide pay figures.
    const canViewPayroll =
      ["owner", "admin", "hr"].includes(auth.role) &&
      (!auth.customRole || Boolean(auth.customRole.permissions.payroll?.includes("view")));

    const today = new Date().toISOString().slice(0, 10);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const countWhere = (
      table: typeof employees | typeof leaveRequests | typeof attendance,
      ...conditions: ReturnType<typeof eq>[]
    ) =>
      db
        .select({ count: count() })
        .from(table)
        .where(and(...conditions));

    const [
      [employeesTotal],
      [activeEmployees],
      [pendingLeaves],
      [approvedLeaves],
      [rejectedLeaves],
      [presentToday],
      [absentToday],
      [newJoiners],
      [departmentsTotal],
      payroll,
    ] = await Promise.all([
      countWhere(employees, eq(employees.tenantId, tenantId)),
      countWhere(
        employees,
        eq(employees.tenantId, tenantId),
        eq(employees.status, "active"),
      ),
      countWhere(
        leaveRequests,
        eq(leaveRequests.tenantId, tenantId),
        eq(leaveRequests.status, "pending"),
      ),
      countWhere(
        leaveRequests,
        eq(leaveRequests.tenantId, tenantId),
        eq(leaveRequests.status, "approved"),
      ),
      countWhere(
        leaveRequests,
        eq(leaveRequests.tenantId, tenantId),
        eq(leaveRequests.status, "rejected"),
      ),
      countWhere(
        attendance,
        eq(attendance.tenantId, tenantId),
        eq(attendance.attendanceDate, today),
        eq(attendance.status, "present"),
      ),
      countWhere(
        attendance,
        eq(attendance.tenantId, tenantId),
        eq(attendance.attendanceDate, today),
        eq(attendance.status, "absent"),
      ),
      db
        .select({ count: count() })
        .from(employees)
        .where(
          and(
            eq(employees.tenantId, tenantId),
            gte(employees.dateOfJoining, thirtyDaysAgo),
          ),
        ),
      db
        .select({ count: count() })
        .from(departments)
        .where(eq(departments.tenantId, tenantId)),
      canViewPayroll ? loadPayrollSummary(tenantId) : Promise.resolve(null),
    ]);

    return NextResponse.json({
      employees: {
        total: employeesTotal.count,
        active: activeEmployees.count,
        newJoiners: newJoiners.count,
      },
      attendance: {
        presentToday: presentToday.count,
        absentToday: absentToday.count,
      },
      leaveRequests: {
        pending: pendingLeaves.count,
        approved: approvedLeaves.count,
        rejected: rejectedLeaves.count,
      },
      departments: {
        total: departmentsTotal.count,
      },
      payrollVisible: canViewPayroll,
      payroll: {
        totalRecords: payroll?.totalRecords ?? 0,
        latestPeriod: payroll?.latestPeriod ?? null,
        latestPeriodNetTotal: payroll?.latestPeriodNetTotal ?? "0",
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

async function loadPayrollSummary(tenantId: string) {
  const [[totalRecords], [latestPeriod]] = await Promise.all([
    db
      .select({ count: count() })
      .from(payrollRecords)
      .where(eq(payrollRecords.tenantId, tenantId)),
    db
      .select({ payrollPeriod: payrollRecords.payrollPeriod })
      .from(payrollRecords)
      .where(eq(payrollRecords.tenantId, tenantId))
      .orderBy(sql`${payrollRecords.payrollPeriod} desc`)
      .limit(1),
  ]);

  if (!latestPeriod) {
    return {
      totalRecords: totalRecords.count,
      latestPeriod: null,
      latestPeriodNetTotal: "0",
    };
  }

  const [summary] = await db
    .select({ netSalary: sql<string>`sum(${payrollRecords.netSalary})` })
    .from(payrollRecords)
    .where(
      and(
        eq(payrollRecords.tenantId, tenantId),
        eq(payrollRecords.payrollPeriod, latestPeriod.payrollPeriod),
      ),
    );

  return {
    totalRecords: totalRecords.count,
    latestPeriod: latestPeriod.payrollPeriod,
    latestPeriodNetTotal: summary?.netSalary ?? "0",
  };
}
