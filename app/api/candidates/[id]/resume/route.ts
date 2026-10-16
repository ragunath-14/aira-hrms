import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/db";
import { candidateResumes, candidates } from "@/db/schema";
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

// A candidate's resume, for the hiring team only. Always sent as a download:
// the file came from an anonymous visitor, so the browser never opens it here.
export async function GET(request: Request, { params }: Ctx) {
  try {
    const actor = await getActor(request);
    if (!actor) return unauthorized();
    if (!actor.isHr) return forbidden();

    const { id } = await params;
    if (!isUuid(id)) return invalid("Invalid id");

    const [row] = await db
      .select({
        name: candidates.resumeName,
        mime: candidates.resumeMime,
        data: candidateResumes.data,
      })
      .from(candidates)
      .innerJoin(candidateResumes, eq(candidateResumes.candidateId, candidates.id))
      .where(and(eq(candidates.id, id), eq(candidates.tenantId, actor.tenant.id)))
      .limit(1);

    if (!row) return notFound("Resume");

    const fileName = (row.name ?? "resume").replace(/[^\w. -]/g, "_");

    return new NextResponse(new Uint8Array(row.data), {
      headers: {
        "Content-Type": row.mime ?? "application/octet-stream",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return serverError("Resume download", error);
  }
}
