import { and, desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { attendance } from "@/db/schema/attendance";
import { employees } from "@/db/schema/employees";
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/authorization";
export async function GET(request: Request) {
  try {
    const auth = await requireRole(request, [
      "owner",
      "admin",
      "hr",
      "manager",
      "employee",
    ]);

    if (!auth.authorized) {
      return NextResponse.json(
        { error: auth.error },
        { status: auth.status },
      );
    }

    const { tenant, user } = auth;

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

    const history = await db
      .select()
      .from(attendance)
      .where(
        and(
          eq(attendance.tenantId, tenant.id),
          eq(attendance.employeeId, employee.id),
        ),
      )
      .orderBy(desc(attendance.attendanceDate));

    return Response.json(history);
  } catch (error) {
    console.error("Attendance history error:", error);

    return Response.json(
      { error: "Failed to fetch attendance history" },
      { status: 500 },
    );
  }
}