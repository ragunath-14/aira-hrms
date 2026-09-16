import { eq, and } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { attendance } from "@/db/schema/attendance";
import { employees } from "@/db/schema/employees";
import { getCurrentTenant } from "@/lib/authorization";
import { requireRole } from "@/lib/authorization";
export async function POST(request: Request) {
  try {
    const context = await getCurrentTenant(request);

    if (!context) {
      return Response.json(
        { error: "Unauthorized" },
        { status: 401 },
      );
    }
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

    const [existingAttendance] = await db
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

    if (existingAttendance) {
      return Response.json(
        {
          error: "Already checked in",
          attendance: existingAttendance,
        },
        { status: 409 },
      );
    }

    const now = new Date();

    const [createdAttendance] = await db
      .insert(attendance)
      .values({
        tenantId: tenant.id,
        employeeId: employee.id,
        attendanceDate: today,
        checkIn: now,
        status: "present",
      })
      .returning();

    return Response.json(createdAttendance, { status: 201 });
  } catch (error) {
    console.error("Check-in error:", error);

    return Response.json(
      { error: "Failed to check in" },
      { status: 500 },
    );
  }
}
