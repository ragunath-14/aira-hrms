import { NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";

import { db } from "@/db";
import { shifts } from "@/db/schema";
import { logAudit } from "@/lib/domain/audit";
import { shiftCreateSchema } from "@/lib/validation/schemas";
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

    const rows = await db
      .select()
      .from(shifts)
      .where(eq(shifts.tenantId, actor.tenant.id))
      .orderBy(asc(shifts.startTime));

    return NextResponse.json(rows);
  } catch (error) {
    return serverError("Shifts fetch", error);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await getActor(request);
    if (!actor) return unauthorized();
    if (!actor.isHr) return forbidden();

    const parsed = shiftCreateSchema.safeParse(await request.json());
    if (!parsed.success) return invalid(parsed.error.flatten());

    const [created] = await db
      .insert(shifts)
      .values({ tenantId: actor.tenant.id, ...parsed.data })
      .returning();

    await logAudit({
      tenantId: actor.tenant.id,
      userId: actor.user.id,
      action: "shift_created",
      entity: "shift",
      entityId: created.id,
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return serverError("Shift create", error);
  }
}
