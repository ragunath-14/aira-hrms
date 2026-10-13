import { eq, and } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { attendance } from "@/db/schema/attendance";
import { employees } from "@/db/schema/employees";
import { requireRole } from "@/lib/auth/authorization";
import { logAudit } from "@/lib/domain/audit";
import { dateInZone, resolveSettings, statusForCheckIn } from "@/lib/config/settings";
export async function POST(request: Request) {
  try {
    // requireRole already resolves the tenant/user context internally —
    // calling getCurrentTenant separately here duplicated that DB
    // round-trip on every check-in.
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

    if (existingAttendance) {
      return Response.json(
        {
          error: "Already checked in",
          attendance: existingAttendance,
        },
        { status: 409 },
      );
    }

    // Optional body: { workMode: "office" | "remote" }
    const body = await request.json().catch(() => ({}));
    const workMode = body?.workMode === "remote" ? "remote" : "office";

    const now = new Date();

    const [createdAttendance] = await db
      .insert(attendance)
      .values({
        tenantId: tenant.id,
        employeeId: employee.id,
        attendanceDate: today,
        checkIn: now,
        status: statusForCheckIn(now, settings),
        workMode,
      })
      .returning();

    await logAudit({
      tenantId: tenant.id,
      userId: user.id,
      action: "attendance_check_in",
      entity: "attendance",
      entityId: createdAttendance.id,
    });

    return Response.json(createdAttendance, { status: 201 });
  } catch (error) {
    console.error("Check-in error:", error);

    return Response.json(
      { error: "Failed to check in" },
      { status: 500 },
    );
  }
}
