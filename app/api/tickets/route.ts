import { NextResponse } from "next/server";
import { and, desc, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { employees, ticketComments, tickets } from "@/db/schema";
import { logAudit } from "@/lib/domain/audit";
import { createNotification } from "@/lib/domain/notifications";
import { ticketCreateSchema } from "@/lib/validation/schemas";
import { getActor, invalid, serverError, unauthorized } from "@/lib/domain/workplace";
import { memberships } from "@/db/schema";
import { inArray } from "drizzle-orm";

export async function GET(request: Request) {
  try {
    const actor = await getActor(request);
    if (!actor) return unauthorized();

    const rows = await db
      .select({
        ticket: tickets,
        firstName: employees.firstName,
        lastName: employees.lastName,
        employeeCode: employees.employeeCode,
        commentCount: sql<number>`(select count(*)::int from ${ticketComments} where ${ticketComments.ticketId} = ${tickets.id} and ${ticketComments.deletedAt} is null)`,
      })
      .from(tickets)
      .innerJoin(employees, eq(employees.id, tickets.employeeId))
      .where(
        actor.isHr
          ? eq(tickets.tenantId, actor.tenant.id)
          : and(
              eq(tickets.tenantId, actor.tenant.id),
              eq(tickets.employeeId, actor.employee.id),
            ),
      )
      .orderBy(desc(tickets.updatedAt))
      .limit(300);

    return NextResponse.json(
      rows.map((r) => ({
        ...r.ticket,
        employeeName: [r.firstName, r.lastName].filter(Boolean).join(" "),
        employeeCode: r.employeeCode,
        commentCount: r.commentCount,
      })),
    );
  } catch (error) {
    return serverError("Tickets fetch", error);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await getActor(request);
    if (!actor) return unauthorized();

    const parsed = ticketCreateSchema.safeParse(await request.json());
    if (!parsed.success) return invalid(parsed.error.flatten());

    const [created] = await db
      .insert(tickets)
      .values({
        tenantId: actor.tenant.id,
        employeeId: actor.employee.id,
        ...parsed.data,
      })
      .returning();

    // Let HR know there is something new to look at.
    const hr = await db
      .select({ userId: memberships.userId })
      .from(memberships)
      .where(
        and(
          eq(memberships.tenantId, actor.tenant.id),
          inArray(memberships.role, ["owner", "admin", "hr"]),
        ),
      );

    await Promise.all(
      hr
        .filter((m) => m.userId !== actor.user.id)
        .map((m) =>
          createNotification({
            tenantId: actor.tenant.id,
            userId: m.userId,
            type: "ticket_created",
            title: "New helpdesk ticket",
            message: created.subject,
          }),
        ),
    );

    await logAudit({
      tenantId: actor.tenant.id,
      userId: actor.user.id,
      action: "ticket_created",
      entity: "ticket",
      entityId: created.id,
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return serverError("Ticket create", error);
  }
}
