import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";

import { db } from "@/db";
import {
  employees,
  leaveRequests,
  leaveTypes,
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

    const requests = await db
      .select({
        id: leaveRequests.id,
        leaveTypeId: leaveRequests.leaveTypeId,
        leaveType: leaveTypes.name,
        startDate: leaveRequests.startDate,
        endDate: leaveRequests.endDate,
        totalDays: leaveRequests.totalDays,
        reason: leaveRequests.reason,
        status: leaveRequests.status,
        managerComment: leaveRequests.managerComment,
        createdAt: leaveRequests.createdAt,
      })
      .from(leaveRequests)
      .leftJoin(
        leaveTypes,
        eq(leaveRequests.leaveTypeId, leaveTypes.id),
      )
      .where(
        and(
          eq(leaveRequests.employeeId, employee.id),
          eq(leaveRequests.tenantId, tenant.id),
        ),
      )
      .orderBy(desc(leaveRequests.createdAt));

    return NextResponse.json(requests);
  } catch (error) {
    console.error(
      "GET employee leave requests error:",
      error,
    );

    return NextResponse.json(
      { error: "Failed to fetch employee leave requests" },
      { status: 500 },
    );
  }
}
