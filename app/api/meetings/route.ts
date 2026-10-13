import { NextResponse } from "next/server";
import { and, asc, desc, eq, gte, inArray, lt, or } from "drizzle-orm";

import { db } from "@/db";
import { employees } from "@/db/schema/employees";
import { meetingAttendees, meetings } from "@/db/schema/meetings";
import { getOrCreateCurrentEmployee } from "@/lib/auth/authorization";
import { logAudit } from "@/lib/domain/audit";
import { isJoinable, joinUrl, newRoomName } from "@/lib/domain/meetings";
import { createNotification } from "@/lib/domain/notifications";
import { resolveSettings } from "@/lib/config/settings";
import { zodMessage } from "@/lib/format/error-text";
import { meetingCreateSchema } from "@/lib/validation/schemas";

const fullName = (e: { firstName: string; lastName: string | null }) =>
  [e.firstName, e.lastName].filter(Boolean).join(" ");

// Meetings you organise or are invited to. ?scope=history shows past ones.
export async function GET(request: Request) {
  try {
    const context = await getOrCreateCurrentEmployee(request);

    if (!context) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { tenant, employee: me } = context;
    const history = new URL(request.url).searchParams.get("scope") === "history";

    // "Upcoming" includes meetings still running; each ends startsAt + duration.
    const cutoff = new Date(Date.now() - 8 * 3_600_000);

    const invited = db
      .select({ id: meetingAttendees.meetingId })
      .from(meetingAttendees)
      .where(eq(meetingAttendees.employeeId, me.id));

    const rows = await db
      .select()
      .from(meetings)
      .where(
        and(
          eq(meetings.tenantId, tenant.id),
          or(eq(meetings.organizerId, me.id), inArray(meetings.id, invited)),
          history ? lt(meetings.startsAt, cutoff) : gte(meetings.startsAt, cutoff),
        ),
      )
      .orderBy(history ? desc(meetings.startsAt) : asc(meetings.startsAt))
      .limit(history ? 30 : 50);

    const ids = rows.map((m) => m.id);

    const [attendeeRows, organizers] = ids.length
      ? await Promise.all([
          db
            .select({
              meetingId: meetingAttendees.meetingId,
              id: employees.id,
              firstName: employees.firstName,
              lastName: employees.lastName,
            })
            .from(meetingAttendees)
            .innerJoin(employees, eq(employees.id, meetingAttendees.employeeId))
            .where(inArray(meetingAttendees.meetingId, ids)),
          db
            .select({ id: employees.id, firstName: employees.firstName, lastName: employees.lastName })
            .from(employees)
            .where(inArray(employees.id, rows.map((m) => m.organizerId))),
        ])
      : [[], []];

    const organizerName = new Map(organizers.map((o) => [o.id, fullName(o)]));

    return NextResponse.json(
      rows
        .filter((m) => history || m.status !== "cancelled")
        .map((m) => ({
          id: m.id,
          title: m.title,
          description: m.description,
          kind: m.kind,
          startsAt: m.startsAt,
          durationMinutes: m.durationMinutes,
          status: m.status,
          joinUrl: m.status === "cancelled" ? null : joinUrl(m.room),
          joinable: m.status !== "cancelled" && isJoinable(m.startsAt, m.durationMinutes),
          isOrganizer: m.organizerId === me.id,
          organizer: organizerName.get(m.organizerId) ?? "",
          attendees: attendeeRows
            .filter((a) => a.meetingId === m.id)
            .map((a) => ({ id: a.id, name: fullName(a) })),
        })),
    );
  } catch (error) {
    console.error("GET meetings error:", error);

    return NextResponse.json({ error: "Failed to load meetings" }, { status: 500 });
  }
}

// Schedule a meeting and invite colleagues.
export async function POST(request: Request) {
  try {
    const context = await getOrCreateCurrentEmployee(request);

    if (!context) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsed = meetingCreateSchema.safeParse(await request.json());

    if (!parsed.success) {
      return NextResponse.json({ error: zodMessage(parsed.error) }, { status: 400 });
    }

    const { tenant, employee: me, user } = context;
    const data = parsed.data;
    const startsAt = new Date(data.startsAt);

    if (startsAt.getTime() < Date.now() - 5 * 60_000) {
      return NextResponse.json({ error: "Choose a start time that has not passed" }, { status: 400 });
    }

    const attendeeIds = [...new Set(data.attendeeIds)].filter((id) => id !== me.id);

    // Invitees must be active colleagues in this company.
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
      return NextResponse.json({ error: "Some invitees were not found" }, { status: 400 });
    }

    const room = newRoomName();

    const [created] = await db
      .insert(meetings)
      .values({
        tenantId: tenant.id,
        organizerId: me.id,
        title: data.title,
        description: data.description || null,
        kind: "scheduled",
        startsAt,
        durationMinutes: data.durationMinutes,
        room,
      })
      .returning();

    if (invitees.length) {
      await db
        .insert(meetingAttendees)
        .values(invitees.map((i) => ({ meetingId: created.id, employeeId: i.id })));
    }

    const timezone = resolveSettings(tenant.settings).timezone;
    const when = new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone,
      dateStyle: "medium",
      timeStyle: "short",
    }).format(startsAt);

    await Promise.all(
      invitees
        .filter((i) => i.userId)
        .map((i) =>
          createNotification({
            tenantId: tenant.id,
            userId: i.userId!,
            type: "meeting_invite",
            title: `Meeting invitation: ${data.title}`,
            message: `${fullName(me)} invited you to a meeting on ${when} (${data.durationMinutes} min).`,
            link: joinUrl(room),
          }),
        ),
    );

    await logAudit({
      tenantId: tenant.id,
      userId: user.id,
      action: "meeting_scheduled",
      entity: "meeting",
      entityId: created.id,
    });

    return NextResponse.json({ id: created.id, joinUrl: joinUrl(room) }, { status: 201 });
  } catch (error) {
    console.error("POST meeting error:", error);

    return NextResponse.json({ error: "Failed to schedule the meeting" }, { status: 500 });
  }
}
