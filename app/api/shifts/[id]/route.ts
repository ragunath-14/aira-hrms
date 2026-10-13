import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { shifts } from "@/db/schema";
import { isUuid } from "@/lib/validation/ids";
import {
  forbidden,
  getActor,
  invalid,
  notFound,
  serverError,
  unauthorized,
} from "@/lib/domain/workplace";

type Ctx = { params: Promise<{ id: string }> };

export async function DELETE(request: Request, { params }: Ctx) {
  try {
    const actor = await getActor(request);
    if (!actor) return unauthorized();
    if (!actor.isHr) return forbidden();

    const { id } = await params;
    if (!isUuid(id)) return invalid("Invalid id");

    // Assignments for this shift are removed with it (cascade).
    const [deleted] = await db
      .delete(shifts)
      .where(and(eq(shifts.id, id), eq(shifts.tenantId, actor.tenant.id)))
      .returning();

    if (!deleted) return notFound("Shift");
    return NextResponse.json({ success: true });
  } catch (error) {
    return serverError("Shift delete", error);
  }
}
