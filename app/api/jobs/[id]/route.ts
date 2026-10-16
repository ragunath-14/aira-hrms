import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { jobOpenings } from "@/db/schema";
import { logAudit } from "@/lib/domain/audit";
import { isUuid } from "@/lib/validation/ids";
import { jobUpdateSchema } from "@/lib/validation/schemas";
import {
  forbidden,
  getActor,
  invalid,
  notFound,
  serverError,
  unauthorized,
} from "@/lib/domain/workplace";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Ctx) {
  try {
    const actor = await getActor(request);
    if (!actor) return unauthorized();
    if (!actor.isHr) return forbidden();

    const { id } = await params;
    if (!isUuid(id)) return invalid("Invalid id");

    const parsed = jobUpdateSchema.safeParse(await request.json());
    if (!parsed.success) return invalid(parsed.error.flatten());

    const [updated] = await db
      .update(jobOpenings)
      .set({
        ...(parsed.data.status ? { status: parsed.data.status } : {}),
        ...(parsed.data.published !== undefined ? { published: parsed.data.published } : {}),
      })
      .where(and(eq(jobOpenings.id, id), eq(jobOpenings.tenantId, actor.tenant.id)))
      .returning();

    if (!updated) return notFound("Job opening");
    return NextResponse.json(updated);
  } catch (error) {
    return serverError("Job update", error);
  }
}

export async function DELETE(request: Request, { params }: Ctx) {
  try {
    const actor = await getActor(request);
    if (!actor) return unauthorized();
    if (!actor.isHr) return forbidden();

    const { id } = await params;
    if (!isUuid(id)) return invalid("Invalid id");

    const [deleted] = await db
      .delete(jobOpenings)
      .where(and(eq(jobOpenings.id, id), eq(jobOpenings.tenantId, actor.tenant.id)))
      .returning();

    if (!deleted) return notFound("Job opening");

    await logAudit({
      tenantId: actor.tenant.id,
      userId: actor.user.id,
      action: "job_deleted",
      entity: "job_opening",
      entityId: id,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return serverError("Job delete", error);
  }
}
