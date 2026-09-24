import { eq, and } from "drizzle-orm";

import { db } from "@/db";
import { attendance } from "@/db/schema/attendance";
import { employees } from "@/db/schema/employees";
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/authorization";
import { logAudit } from "@/lib/audit";
export async function POST(request: Request) {
  try {
    // requireRole already resolves the tenant/user context internally —
    // calling getCurrentTenant separately here duplicated that DB
    // round-trip on every check-out.
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

    if (!existingAttendance) {
      return Response.json(
        { error: "Please check in first" },
        { status: 400 },
      );
    }

    if (existingAttendance.checkOut) {
      return Response.json(
        {
          error: "Already checked out",
          attendance: existingAttendance,
        },
        { status: 409 },
      );
    }

    const [updatedAttendance] = await db
      .update(attendance)
      .set({
        checkOut: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(attendance.id, existingAttendance.id),
          eq(attendance.tenantId, tenant.id),
        ),
      )
      .returning();

    await logAudit({
      tenantId: tenant.id,
      userId: user.id,
      action: "attendance_check_out",
      entity: "attendance",
      entityId: updatedAttendance.id,
    });

    return Response.json(updatedAttendance);
  } catch (error) {
    console.error("Check-out error:", error);

    return Response.json(
      { error: "Failed to check out" },
      { status: 500 },
    );
  }
}