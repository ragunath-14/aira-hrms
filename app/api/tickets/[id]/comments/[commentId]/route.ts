import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { ticketComments, tickets } from "@/db/schema";
import { logAudit } from "@/lib/domain/audit";
import { isUuid } from "@/lib/validation/ids";
import { getActor, invalid, notFound, serverError, unauthorized } from "@/lib/domain/workplace";

type Ctx = { params: Promise<{ id: string; commentId: string }> };

// "Delete for everyone": the text is erased and the message stays in the
// thread as "This message was deleted". The author can delete their own
// message; HR can remove any message.
export async function DELETE(request: Request, { params }: Ctx) {
  try {
    const actor = await getActor(request);
    if (!actor) return unauthorized();

    const { id, commentId } = await params;
    if (!isUuid(id) || !isUuid(commentId)) return invalid("Invalid id");

    const [ticket] = await db
      .select({ id: tickets.id, employeeId: tickets.employeeId })
      .from(tickets)
      .where(and(eq(tickets.id, id), eq(tickets.tenantId, actor.tenant.id)))
      .limit(1);

    // Same visibility rule as the ticket itself: HR sees all, others their own.
    if (!ticket || (!actor.isHr && ticket.employeeId !== actor.employee.id)) {
      return notFound("Ticket");
    }

    const [comment] = await db
      .select()
      .from(ticketComments)
      .where(
        and(
          eq(ticketComments.id, commentId),
          eq(ticketComments.ticketId, id),
          eq(ticketComments.tenantId, actor.tenant.id),
        ),
      )
      .limit(1);

    if (!comment) return notFound("Message");

    if (comment.userId !== actor.user.id && !actor.isHr) {
      return NextResponse.json({ error: "You can only delete your own messages" }, { status: 403 });
    }

    if (!comment.deletedAt) {
      await db
        .update(ticketComments)
        .set({ body: "", deletedAt: new Date() })
        .where(eq(ticketComments.id, commentId));

      await logAudit({
        tenantId: actor.tenant.id,
        userId: actor.user.id,
        action: "ticket_message_deleted",
        entity: "ticket",
        entityId: id,
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return serverError("Ticket message delete", error);
  }
}
