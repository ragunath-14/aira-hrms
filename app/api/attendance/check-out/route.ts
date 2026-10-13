import { eq, and } from "drizzle-orm";

import { db } from "@/db";
import { attendance } from "@/db/schema/attendance";
import { employees } from "@/db/schema/employees";
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/authorization";
import { logAudit } from "@/lib/domain/audit";
import { dateInZone, resolveSettings } from "@/lib/config/settings";
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

    const settings = resolveSettings(tenant.settings);
    const today = dateInZone(new Date(), settings.timezone);

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

    const checkOut = new Date();

    // A day shorter than the company's minimum counts as a half day.
    const workedHours =
      existingAttendance.checkIn
        ? (checkOut.getTime() - existingAttendance.checkIn.getTime()) / 3_600_000
        : null;
    const shortDay =
      workedHours !== null &&
      workedHours < settings.minFullDayHours &&
      (existingAttendance.status === "present" || existingAttendance.status === "late");

    const [updatedAttendance] = await db
      .update(attendance)
      .set({
        checkOut,
        breakType: null,
        breakUntil: null,
        ...(shortDay ? { status: "half_day" } : {}),
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