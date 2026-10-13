import { NextResponse } from "next/server";
import { and, eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import { employees } from "@/db/schema/employees";
import { meetingAttendees, meetings } from "@/db/schema/meetings";
import { getOrCreateCurrentEmployee } from "@/lib/auth/authorization";
import { joinUrl, newRoomName } from "@/lib/domain/meetings";
import { createNotification } from "@/lib/domain/notifications";
import { zodMessage } from "@/lib/format/error-text";
import { instantMeetingSchema } from "@/lib/validation/schemas";

// Start a meeting right now ("Meet Now"), or ring one colleague ("Call").
// Invitees get a notification with a link to join.
export async function POST(request: Request) {
  try {
    const context = await getOrCreateCurrentEmployee(request);

    if (!context) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsed = instantMeetingSchema.safeParse(await request.json().catch(() => ({})));

    if (!parsed.success) {
      return NextResponse.json({ error: zodMessage(parsed.error) }, { status: 400 });
    }

    const { tenant, employee: me } = context;
    const attendeeIds = [...new Set(parsed.data.attendeeIds)].filter((id) => id !== me.id);

    const invitees = attendeeIds.length
      ? await db
          .select({ id: employees.id, userId: employees.userId })
          .from(employees)
          .where(
            and(
              eq(employees.tenantId, tenant.id),
              eq(employees.status, "active"),
              inArray(employees.id, attendeeIds),
            ),
          )
      : [];

    if (invitees.length !== attendeeIds.length) {
      return NextResponse.json({ error: "That person was not found" }, { status: 400 });
    }

    const isCall = invitees.length === 1;
    const myName = [me.firstName, me.lastName].filter(Boolean).join(" ");
    const room = newRoomName();

    const [created] = await db
      .insert(meetings)
      .values({
        tenantId: tenant.id,
        organizerId: me.id,
        title: parsed.data.title || (isCall ? `Call from ${myName}` : `${myName}'s meeting`),
        kind: isCall ? "call" : "instant",
        startsAt: new Date(),
        durationMinutes: 60,
        room,
      })
      .returning();

    if (invitees.length) {
      await db
        .insert(meetingAttendees)
        .values(invitees.map((i) => ({ meetingId: created.id, employeeId: i.id })));
    }

    await Promise.all(
      invitees
        .filter((i) => i.userId)
        .map((i) =>
          createNotification({
            tenantId: tenant.id,
            userId: i.userId!,
            type: isCall ? "meeting_call" : "meeting_invite",
            title: isCall ? `${myName} is calling you` : `${myName} started a meeting`,
            message: "Open the link to join now.",
            link: joinUrl(room),
          }),
        ),
    );

    return NextResponse.json({ id: created.id, joinUrl: joinUrl(room) }, { status: 201 });
  } catch (error) {
    console.error("POST instant meeting error:", error);

    return NextResponse.json({ error: "Failed to start the meeting" }, { status: 500 });
  }
}
