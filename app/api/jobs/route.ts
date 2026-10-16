import { NextResponse } from "next/server";
import { desc, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { candidates, departments, jobOpenings } from "@/db/schema";
import { logAudit } from "@/lib/domain/audit";
import { jobCreateSchema } from "@/lib/validation/schemas";
import {
  forbidden,
  getActor,
  invalid,
  serverError,
  unauthorized,
} from "@/lib/domain/workplace";

export async function GET(request: Request) {
  try {
    const actor = await getActor(request);
    if (!actor) return unauthorized();
    if (!actor.isHr) return forbidden();

    const rows = await db
      .select({
        job: jobOpenings,
        departmentName: departments.name,
        candidateCount: sql<number>`(select count(*)::int from ${candidates} where ${candidates.jobId} = ${jobOpenings.id})`,
      })
      .from(jobOpenings)
      .leftJoin(departments, eq(departments.id, jobOpenings.departmentId))
      .where(eq(jobOpenings.tenantId, actor.tenant.id))
      .orderBy(desc(jobOpenings.createdAt));

    return NextResponse.json(
      rows.map((r) => ({
        ...r.job,
        departmentName: r.departmentName,
        candidateCount: r.candidateCount,
      })),
    );
  } catch (error) {
    return serverError("Jobs fetch", error);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await getActor(request);
    if (!actor) return unauthorized();
    if (!actor.isHr) return forbidden();

    const parsed = jobCreateSchema.safeParse(await request.json());
    if (!parsed.success) return invalid(parsed.error.flatten());

    if (parsed.data.departmentId) {
      const [dept] = await db
        .select({ tenantId: departments.tenantId })
        .from(departments)
        .where(eq(departments.id, parsed.data.departmentId))
        .limit(1);

      if (!dept || dept.tenantId !== actor.tenant.id) {
        return invalid("Unknown department");
      }
    }

    const [created] = await db
      .insert(jobOpenings)
      .values({
        tenantId: actor.tenant.id,
        title: parsed.data.title,
        departmentId: parsed.data.departmentId ?? null,
        location: parsed.data.location || null,
        employmentType: parsed.data.employmentType,
        openings: parsed.data.openings,
        description: parsed.data.description || null,
        published: parsed.data.published,
      })
      .returning();

    await logAudit({
      tenantId: actor.tenant.id,
      userId: actor.user.id,
      action: "job_created",
      entity: "job_opening",
      entityId: created.id,
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return serverError("Job create", error);
  }
}
