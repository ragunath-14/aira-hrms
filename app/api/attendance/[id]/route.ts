import { isUuid } from "@/lib/validation/ids";
import { eq, and } from "drizzle-orm";

import { db } from "@/db";
import { attendance } from "@/db/schema/attendance";
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/authorization";
import { payrollLockMessage } from "@/lib/domain/payroll-lock";
import { logAudit } from "@/lib/domain/audit";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireRole(request, [
      "owner",
      "admin",
      "hr",
      "manager",
    ]);

    if (!auth.authorized) {
      return Response.json(
        { error: auth.error },
        { status: auth.status },
      );
    }

    const { tenant } = auth;

    const { id } = await params;
    if (!isUuid(id)) {
      return Response.json({ error: "Invalid id" }, { status: 400 });
    }

    // A month already paid is final for this person.
    const [record] = await db
      .select({ employeeId: attendance.employeeId, date: attendance.attendanceDate })
      .from(attendance)
      .where(and(eq(attendance.id, id), eq(attendance.tenantId, tenant.id)))
      .limit(1);

    if (record) {
      const locked = await payrollLockMessage({
        tenantId: tenant.id,
        settings: tenant.settings,
        employeeId: record.employeeId,
        startDate: record.date,
        endDate: record.date,
        affects: "attendance",
      });

      if (locked) return Response.json({ error: locked }, { status: 409 });
    }

    const body = await request.json();

    const allowedStatuses = [
      "present",
      "absent",
      "late",
      "half_day",
      "leave",
      "holiday",
    ] as const;

    if (
      body.status !== undefined &&
      !allowedStatuses.includes(body.status)
    ) {
      return Response.json(
        { error: "Invalid attendance status" },
        { status: 400 },
      );
    }

    const updateData: {
      status?: (typeof allowedStatuses)[number];
      notes?: string | null;
      checkIn?: Date | null;
      checkOut?: Date | null;
      updatedAt: Date;
    } = {
      updatedAt: new Date(),
    };

    if (
      body.notes !== undefined &&
      body.notes !== null &&
      (typeof body.notes !== "string" || body.notes.length > 500)
    ) {
      return Response.json(
        { error: "Notes must be text of at most 500 characters" },
        { status: 400 },
      );
    }

    // Wrong punches can be fixed: send ISO times (or null to clear one).
    const parseTime = (value: unknown) => {
      if (value === null || value === "") return null;
      const date = new Date(String(value));
      return Number.isNaN(date.getTime()) ? undefined : date;
    };

    const checkIn = body.checkIn === undefined ? undefined : parseTime(body.checkIn);
    const checkOut = body.checkOut === undefined ? undefined : parseTime(body.checkOut);

    if (checkIn === undefined && body.checkIn !== undefined) {
      return Response.json({ error: "Check-in time is not valid" }, { status: 400 });
    }
    if (checkOut === undefined && body.checkOut !== undefined) {
      return Response.json({ error: "Check-out time is not valid" }, { status: 400 });
    }

    const now = Date.now() + 5 * 60 * 1000;
    if ((checkIn && checkIn.getTime() > now) || (checkOut && checkOut.getTime() > now)) {
      return Response.json({ error: "Times cannot be in the future" }, { status: 400 });
    }

    if (checkIn !== undefined) updateData.checkIn = checkIn;
    if (checkOut !== undefined) updateData.checkOut = checkOut;

    if (body.status !== undefined) {
      updateData.status = body.status;
    }

    if (body.notes !== undefined) {
      updateData.notes = body.notes;
    }

    // Check-out must be after check-in, using the stored value for any side not sent.
    if (checkIn !== undefined || checkOut !== undefined) {
      const [current] = await db
        .select({ checkIn: attendance.checkIn, checkOut: attendance.checkOut })
        .from(attendance)
        .where(and(eq(attendance.id, id), eq(attendance.tenantId, tenant.id)))
        .limit(1);

      const finalIn = checkIn !== undefined ? checkIn : current?.checkIn;
      const finalOut = checkOut !== undefined ? checkOut : current?.checkOut;

      if (finalIn && finalOut && finalOut <= finalIn) {
        return Response.json(
          { error: "Check-out must be after check-in" },
          { status: 400 },
        );
      }
    }

    const [updatedAttendance] = await db
      .update(attendance)
      .set(updateData)
      .where(
        and(
          eq(attendance.id, id),
          eq(attendance.tenantId, tenant.id),
        ),
      )
      .returning();

    if (!updatedAttendance) {
      return Response.json(
        { error: "Attendance record not found" },
        { status: 404 },
      );
    }

    await logAudit({
      tenantId: tenant.id,
      userId: auth.user.id,
      action: "attendance_corrected",
      entity: "attendance",
      entityId: id,
    });

    return Response.json(updatedAttendance);
  } catch (error) {
    console.error("Attendance update error:", error);

    return Response.json(
      { error: "Failed to update attendance" },
      { status: 500 },
    );
  }
}


// Remove a wrong or duplicate attendance record.
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireRole(request, ["owner", "admin", "hr"]);

    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { id } = await params;
    if (!isUuid(id)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const [record] = await db
      .select({ employeeId: attendance.employeeId, date: attendance.attendanceDate })
      .from(attendance)
      .where(and(eq(attendance.id, id), eq(attendance.tenantId, auth.tenant.id)))
      .limit(1);

    if (record) {
      const locked = await payrollLockMessage({
        tenantId: auth.tenant.id,
        settings: auth.tenant.settings,
        employeeId: record.employeeId,
        startDate: record.date,
        endDate: record.date,
        affects: "attendance",
      });

      if (locked) return NextResponse.json({ error: locked }, { status: 409 });
    }

    const [deleted] = await db
      .delete(attendance)
      .where(and(eq(attendance.id, id), eq(attendance.tenantId, auth.tenant.id)))
      .returning({ id: attendance.id });

    if (!deleted) {
      return NextResponse.json({ error: "Attendance record not found" }, { status: 404 });
    }

    await logAudit({
      tenantId: auth.tenant.id,
      userId: auth.user.id,
      action: "attendance_deleted",
      entity: "attendance",
      entityId: id,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Attendance DELETE error:", error);
    return NextResponse.json({ error: "Failed to delete attendance record" }, { status: 500 });
  }
}
