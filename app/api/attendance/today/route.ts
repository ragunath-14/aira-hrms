import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { attendance } from "@/db/schema/attendance";
import { employees } from "@/db/schema/employees";
import { getCurrentTenant } from "@/lib/authorization";

export async function GET(request: Request) {
  try {
    const context = await getCurrentTenant(request);

    if (!context) {
      return Response.json(
        { error: "Unauthorized" },
        { status: 401 },
      );
    }

    const { tenant, user } = context;

    const [employee] = await db
      .select()
      .from(employees)
      .where(
        and(
          eq(employees.tenantId, tenant.id),
          eq(employees.userId, user.id),
        ),
      )
      .limit(1);

    if (!employee) {
      return Response.json(
        { error: "Employee not found" },
        { status: 404 },
      );
    }

    const today = new Date().toISOString().slice(0, 10);

    const [record] = await db
      .select()
      .from(attendance)
      .where(
        and(
          eq(attendance.tenantId, tenant.id),
          eq(attendance.employeeId, employee.id),
          eq(attendance.attendanceDate, today),
        ),
      )
      .limit(1);

    return Response.json({
      today,
      attendance: record ?? null,
      employeeId: employee.id,
    });
  } catch (error) {
    console.error("GET attendance today error:", error);

    return Response.json(
      { error: "Failed to fetch today's attendance" },
      { status: 500 },
    );
  }
}