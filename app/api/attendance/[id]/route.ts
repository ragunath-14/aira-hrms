import { isUuid } from "@/lib/ids";
import { eq, and } from "drizzle-orm";

import { db } from "@/db";
import { attendance } from "@/db/schema/attendance";
import { requireRole } from "@/lib/authorization";
import { logAudit } from "@/lib/audit";

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
      updatedAt: Date;
    } = {
      updatedAt: new Date(),
    };

    if (body.status !== undefined) {
      updateData.status = body.status;
    }

    if (body.notes !== undefined) {
      updateData.notes = body.notes;
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
