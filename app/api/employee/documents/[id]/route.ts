import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { employeeDocuments } from "@/db/schema";
import { isUuid } from "@/lib/validation/ids";
import { getActor, invalid, notFound, serverError, unauthorized } from "@/lib/domain/workplace";

// An employee removes a document they uploaded themselves. Documents HR added
// (offer letters, contracts) are not theirs to delete.
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await getActor(request);
    if (!actor) return unauthorized();

    const { id } = await params;
    if (!isUuid(id)) return invalid("Invalid id");

    const [deleted] = await db
      .delete(employeeDocuments)
      .where(
        and(
          eq(employeeDocuments.id, id),
          eq(employeeDocuments.tenantId, actor.tenant.id),
          eq(employeeDocuments.employeeId, actor.employee.id),
          eq(employeeDocuments.uploadedBy, actor.user.id),
        ),
      )
      .returning({ id: employeeDocuments.id });

    if (!deleted) return notFound("Document");

    return NextResponse.json({ success: true });
  } catch (error) {
    return serverError("Document delete", error);
  }
}
