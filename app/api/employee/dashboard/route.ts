import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import {
  employees,
  leaveRequests,
  payslips,
  notifications,
} from "@/db/schema";
import { getOrCreateCurrentEmployee } from "@/lib/auth/authorization";

export async function GET(request: Request) {
  try {
    const auth = await getOrCreateCurrentEmployee(request);

    if (!auth) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 },
      );
    }

    const { employee, tenant, user } = auth;

    // Independent queries: run them together so the DB latency is paid once.
    const [leaves, employeePayslips, employeeNotifications] =
      await Promise.all([
        db
          .select()
          .from(leaveRequests)
          .where(
            and(
              eq(leaveRequests.employeeId, employee.id),
              eq(leaveRequests.tenantId, tenant.id),
            ),
          ),
        db
          .select()
          .from(payslips)
          .where(
            and(
              eq(payslips.employeeId, employee.id),
              eq(payslips.tenantId, tenant.id),
            ),
          ),
        db
          .select()
          .from(notifications)
          .where(
            and(
              eq(notifications.userId, user.id),
              eq(notifications.tenantId, tenant.id),
            ),
          ),
      ]);

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
