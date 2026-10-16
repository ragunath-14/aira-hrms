import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { candidates, jobOpenings } from "@/db/schema";
import { logAudit } from "@/lib/domain/audit";
import { queueWebhook } from "@/lib/domain/webhooks";
import { isUuid } from "@/lib/validation/ids";
import { candidateUpdateSchema } from "@/lib/validation/schemas";
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

    const parsed = candidateUpdateSchema.safeParse(await request.json());
    if (!parsed.success) return invalid(parsed.error.flatten());

    const [before] = await db
      .select({ stage: candidates.stage })
      .from(candidates)
      .where(and(eq(candidates.id, id), eq(candidates.tenantId, actor.tenant.id)))
      .limit(1);

    const [updated] = await db
      .update(candidates)
      .set({
        ...(parsed.data.stage ? { stage: parsed.data.stage } : {}),
        ...(parsed.data.notes !== undefined ? { notes: parsed.data.notes } : {}),
        ...(parsed.data.score !== undefined ? { score: parsed.data.score } : {}),
      })
      .where(and(eq(candidates.id, id), eq(candidates.tenantId, actor.tenant.id)))
      .returning();

    if (!updated) return notFound("Candidate");

    // Tell the company's own system when an applicant who came in through the
    // website or API moves to another stage.
    if (parsed.data.stage && before && before.stage !== updated.stage && updated.source !== "manual") {
      const [job] = await db
        .select({ title: jobOpenings.title })
        .from(jobOpenings)
        .where(eq(jobOpenings.id, updated.jobId))
        .limit(1);

      await queueWebhook(actor.tenant.id, "application.stage_changed", {
        applicationId: updated.id,
        jobId: updated.jobId,
        jobTitle: job?.title ?? null,
        name: updated.name,
        email: updated.email,
        previousStage: before.stage,
        stage: updated.stage,
        source: updated.source,
      });
    }

    if (parsed.data.stage) {
      await logAudit({
        tenantId: actor.tenant.id,
        userId: actor.user.id,
        action: `candidate_${parsed.data.stage}`,
        entity: "candidate",
        entityId: id,
      });
    }

    return NextResponse.json(updated);
  } catch (error) {
    return serverError("Candidate update", error);
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
      .delete(candidates)
      .where(and(eq(candidates.id, id), eq(candidates.tenantId, actor.tenant.id)))
      .returning();

    if (!deleted) return notFound("Candidate");
    return NextResponse.json({ success: true });
  } catch (error) {
    return serverError("Candidate delete", error);
  }
}
