import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import {
  employees,
  leaveRequests,
  payslips,
  notifications,
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

    const { user, tenant } = context;

    const [employee] = await db
      .select()
      .from(employees)
      .where(
        and(
          eq(employees.userId, user.id),
          eq(employees.tenantId, tenant.id),
        ),
      )
      .limit(1);

    if (!employee) {
      return NextResponse.json(
        { error: "Employee record not found" },
        { status: 404 },
      );
    }

    const leaves = await db
      .select()
      .from(leaveRequests)
      .where(
        and(
          eq(leaveRequests.employeeId, employee.id),
          eq(leaveRequests.tenantId, tenant.id),
        ),
      );

    const employeePayslips = await db
      .select()
      .from(payslips)
      .where(
        and(
          eq(payslips.employeeId, employee.id),
          eq(payslips.tenantId, tenant.id),
        ),
      );

    const employeeNotifications = await db
      .select()
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, user.id),
          eq(notifications.tenantId, tenant.id),
        ),
      );

    return NextResponse.json({
      employee: {
        id: employee.id,
        employeeCode: employee.employeeCode,
        firstName: employee.firstName,
        lastName: employee.lastName,
        email: employee.email,
        phone: employee.phone,
        status: employee.status,
      },
      leaves,
      payslips: employeePayslips,
      notifications: employeeNotifications,
    });
  } catch (error) {
    console.error("GET employee dashboard error:", error);

    return NextResponse.json(
      { error: "Failed to fetch employee dashboard" },
      { status: 500 },
    );
  }
}
