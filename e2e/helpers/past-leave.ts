import "./env";

import { and, eq } from "drizzle-orm";

import { db } from "../../db";
import { employees, leaveRequests, leaveTypes } from "../../db/schema";

// The app refuses to create leave in the past, so a leave that has already
// started can only exist as stored data. Insert one directly.
export async function insertApprovedLeave(email: string, date: string) {
  const [employee] = await db
    .select()
    .from(employees)
    .where(eq(employees.email, email))
    .limit(1);

  const [sick] = await db
    .select()
    .from(leaveTypes)
    .where(
      and(eq(leaveTypes.tenantId, employee.tenantId), eq(leaveTypes.name, "Sick Leave")),
    )
    .limit(1);

  const [row] = await db
    .insert(leaveRequests)
    .values({
      tenantId: employee.tenantId,
      employeeId: employee.id,
      leaveTypeId: sick.id,
      startDate: date,
      endDate: date,
      totalDays: 1,
      reason: "playwright past-date fixture",
      status: "approved",
    })
    .returning();

  return row;
}
