import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { employees } from "@/db/schema/employees";
import { meetingAttendees, meetings } from "@/db/schema/meetings";
import { getOrCreateCurrentEmployee } from "@/lib/auth/authorization";
import { logAudit } from "@/lib/domain/audit";
import { createNotification } from "@/lib/domain/notifications";
import { isUuid } from "@/lib/validation/ids";

type Ctx = { params: Promise<{ id: string }> };

// The organiser cancels a meeting; invitees are told.
export async function DELETE(request: Request, { params }: Ctx) {
  try {
    const context = await getOrCreateCurrentEmployee(request);

    if (!context) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    if (!isUuid(id)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const { tenant, employee: me, user } = context;

    const [meeting] = await db
      .select()
      .from(meetings)
      .where(and(eq(meetings.id, id), eq(meetings.tenantId, tenant.id)))
      .limit(1);

    if (!meeting) {
      return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
    }

    if (meeting.organizerId !== me.id) {
      return NextResponse.json({ error: "Only the organiser can cancel a meeting" }, { status: 403 });
    }

    if (meeting.status === "cancelled") {
      return NextResponse.json({ success: true });
    }

    await db.update(meetings).set({ status: "cancelled" }).where(eq(meetings.id, id));

    const invitees = await db
      .select({ userId: employees.userId })
      .from(meetingAttendees)
      .innerJoin(employees, eq(employees.id, meetingAttendees.employeeId))
      .where(eq(meetingAttendees.meetingId, id));

    await Promise.all(
      invitees
        .filter((i) => i.userId)
        .map((i) =>
          createNotification({
            tenantId: tenant.id,
            userId: i.userId!,
            type: "meeting_cancelled",
            title: `Meeting cancelled: ${meeting.title}`,
            message: `${[me.firstName, me.lastName].filter(Boolean).join(" ")} cancelled this meeting.`,
          }),
        ),
    );

    await logAudit({
      tenantId: tenant.id,
      userId: user.id,
      action: "meeting_cancelled",
      entity: "meeting",
      entityId: id,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE meeting error:", error);

    return NextResponse.json({ error: "Failed to cancel the meeting" }, { status: 500 });
  }
}
