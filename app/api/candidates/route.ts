import { NextResponse } from "next/server";
import { and, desc, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { candidates, jobOpenings } from "@/db/schema";
import { logAudit } from "@/lib/domain/audit";
import { zodMessage } from "@/lib/format/error-text";
import { candidateCreateSchema } from "@/lib/validation/schemas";
import {
  forbidden,
  getActor,
  invalid,
  notFound,
  serverError,
  unauthorized,
} from "@/lib/domain/workplace";

export async function GET(request: Request) {
  try {
    const actor = await getActor(request);
    if (!actor) return unauthorized();
    if (!actor.isHr) return forbidden();

    const rows = await db
      .select()
      .from(candidates)
      .where(eq(candidates.tenantId, actor.tenant.id))
      .orderBy(desc(candidates.createdAt))
      .limit(500);

    return NextResponse.json(rows);
  } catch (error) {
    return serverError("Candidates fetch", error);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await getActor(request);
    if (!actor) return unauthorized();
    if (!actor.isHr) return forbidden();

    const parsed = candidateCreateSchema.safeParse(await request.json());
    if (!parsed.success) return invalid(zodMessage(parsed.error));

    // The job must belong to this tenant.
    const [job] = await db
      .select({ id: jobOpenings.id })
      .from(jobOpenings)
      .where(
        and(
          eq(jobOpenings.id, parsed.data.jobId),
          eq(jobOpenings.tenantId, actor.tenant.id),
        ),
      )
      .limit(1);

    if (!job) return notFound("Job opening");

    const [duplicate] = await db
      .select({ id: candidates.id })
      .from(candidates)
      .where(
        and(
          eq(candidates.tenantId, actor.tenant.id),
          eq(candidates.jobId, parsed.data.jobId),
          sql`lower(${candidates.email}) = ${parsed.data.email.toLowerCase()}`,
        ),
      )
      .limit(1);

    if (duplicate) {
      return NextResponse.json(
        { error: "This candidate has already applied for this job" },
        { status: 409 },
      );
    }

    const [created] = await db
      .insert(candidates)
      .values({
        tenantId: actor.tenant.id,
        jobId: parsed.data.jobId,
        name: parsed.data.name,
        email: parsed.data.email,
        phone: parsed.data.phone || null,
        notes: parsed.data.notes || null,
      })
      .returning();

    await logAudit({
      tenantId: actor.tenant.id,
      userId: actor.user.id,
      action: "candidate_created",
      entity: "candidate",
      entityId: created.id,
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return serverError("Candidate create", error);
  }
}
