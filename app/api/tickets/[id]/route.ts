import { NextResponse } from "next/server";
import { and, asc, eq } from "drizzle-orm";

import { db } from "@/db";
import { employees, ticketComments, tickets, users } from "@/db/schema";
import { logAudit } from "@/lib/domain/audit";
import { isUuid } from "@/lib/validation/ids";
import { createNotification } from "@/lib/domain/notifications";
import { ticketCommentSchema, ticketUpdateSchema } from "@/lib/validation/schemas";
import {
  forbidden,
  getActor,
  invalid,
  notFound,
  serverError,
  unauthorized,
  type Actor,
} from "@/lib/domain/workplace";

type Ctx = { params: Promise<{ id: string }> };

// A ticket the caller may see: HR sees all in the company, an employee only
// their own. Anything else looks like "not found".
async function loadTicket(actor: Actor, id: string) {
  const [ticket] = await db
    .select()
    .from(tickets)
    .where(and(eq(tickets.id, id), eq(tickets.tenantId, actor.tenant.id)))
    .limit(1);

  if (!ticket) return null;
  if (!actor.isHr && ticket.employeeId !== actor.employee.id) return null;
  return ticket;
}

async function requesterUserId(employeeId: string) {
  const [row] = await db
    .select({ userId: employees.userId })
    .from(employees)
    .where(eq(employees.id, employeeId))
    .limit(1);
  return row?.userId ?? null;
}

export async function GET(request: Request, { params }: Ctx) {
  try {
    const actor = await getActor(request);
    if (!actor) return unauthorized();

    const { id } = await params;
    if (!isUuid(id)) return invalid("Invalid id");

    const ticket = await loadTicket(actor, id);
    if (!ticket) return notFound("Ticket");

    const comments = await db
      .select({
        id: ticketComments.id,
        body: ticketComments.body,
        createdAt: ticketComments.createdAt,
        deletedAt: ticketComments.deletedAt,
        userId: ticketComments.userId,
        authorName: users.name,
      })
      .from(ticketComments)
      .leftJoin(users, eq(users.id, ticketComments.userId))
      .where(eq(ticketComments.ticketId, id))
      .orderBy(asc(ticketComments.createdAt));

    const [requester] = await db
      .select({
        firstName: employees.firstName,
        lastName: employees.lastName,
        employeeCode: employees.employeeCode,
      })
      .from(employees)
      .where(eq(employees.id, ticket.employeeId))
      .limit(1);

    // Deleted messages never leave the server with their text. Authors can
    // delete their own messages; HR can remove any (moderation).
    const safeComments = comments.map(({ userId, deletedAt, body, ...rest }) => ({
      ...rest,
      body: deletedAt ? "" : body,
      deleted: !!deletedAt,
      isMine: userId === actor.user.id,
      canDelete: !deletedAt && (userId === actor.user.id || actor.isHr),
    }));

    return NextResponse.json({
      ...ticket,
      employeeName: [requester?.firstName, requester?.lastName].filter(Boolean).join(" "),
      employeeCode: requester?.employeeCode ?? "",
      comments: safeComments,
    });
  } catch (error) {
    return serverError("Ticket fetch", error);
  }
}

// Change status. HR can set any status; the requester can only close their own.
export async function PATCH(request: Request, { params }: Ctx) {
  try {
    const actor = await getActor(request);
    if (!actor) return unauthorized();

    const { id } = await params;
    if (!isUuid(id)) return invalid("Invalid id");

    const parsed = ticketUpdateSchema.safeParse(await request.json());
    if (!parsed.success) return invalid(parsed.error.flatten());

    const ticket = await loadTicket(actor, id);
    if (!ticket) return notFound("Ticket");

    if (!actor.isHr && parsed.data.status !== "closed") {
      return NextResponse.json(
        { error: "You can only close your own ticket" },
        { status: 403 },
      );
    }

    const [updated] = await db
      .update(tickets)
      .set({ status: parsed.data.status, updatedAt: new Date() })
      .where(eq(tickets.id, id))
      .returning();

    if (actor.isHr) {
      const userId = await requesterUserId(ticket.employeeId);

      if (userId && userId !== actor.user.id) {
        await createNotification({
          tenantId: actor.tenant.id,
          userId,
          type: "ticket_status",
          title: "Your ticket was updated",
          message: `"${ticket.subject}" is now ${parsed.data.status.replace("_", " ")}.`,
        });
      }
    }

    await logAudit({
      tenantId: actor.tenant.id,
      userId: actor.user.id,
      action: `ticket_${parsed.data.status}`,
      entity: "ticket",
      entityId: id,
    });

    return NextResponse.json(updated);
  } catch (error) {
    return serverError("Ticket update", error);
  }
}

// Add a comment.
export async function POST(request: Request, { params }: Ctx) {
  try {
    const actor = await getActor(request);
    if (!actor) return unauthorized();

    const { id } = await params;
    if (!isUuid(id)) return invalid("Invalid id");

    const parsed = ticketCommentSchema.safeParse(await request.json());
    if (!parsed.success) return invalid(parsed.error.flatten());

    const ticket = await loadTicket(actor, id);
    if (!ticket) return notFound("Ticket");

    const [comment] = await db
      .insert(ticketComments)
      .values({
        tenantId: actor.tenant.id,
        ticketId: id,
        userId: actor.user.id,
        body: parsed.data.body,
      })
      .returning();

    await db
      .update(tickets)
      .set({ updatedAt: new Date() })
      .where(eq(tickets.id, id));

    // HR replying notifies the requester.
    if (actor.isHr) {
      const userId = await requesterUserId(ticket.employeeId);

      if (userId && userId !== actor.user.id) {
        await createNotification({
          tenantId: actor.tenant.id,
          userId,
          type: "ticket_reply",
          title: "New reply on your ticket",
          message: ticket.subject,
        });
      }
    }

    return NextResponse.json(comment, { status: 201 });
  } catch (error) {
    return serverError("Ticket comment", error);
  }
}

// HR can remove a ticket (and its replies) once it is no longer needed.
export async function DELETE(request: Request, { params }: Ctx) {
  try {
    const actor = await getActor(request);
    if (!actor) return unauthorized();
    if (!actor.isHr) return forbidden();

    const { id } = await params;
    if (!isUuid(id)) return invalid("Invalid id");

    const [deleted] = await db
      .delete(tickets)
      .where(and(eq(tickets.id, id), eq(tickets.tenantId, actor.tenant.id)))
      .returning({ id: tickets.id });

    if (!deleted) return notFound("Ticket");

    await logAudit({
      tenantId: actor.tenant.id,
      userId: actor.user.id,
      action: "ticket_deleted",
      entity: "ticket",
      entityId: id,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return serverError("Ticket delete", error);
  }
}
