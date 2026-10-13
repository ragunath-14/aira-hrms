import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { onboardingTasks } from "@/db/schema";
import { isUuid } from "@/lib/validation/ids";
import { onboardingTaskUpdateSchema } from "@/lib/validation/schemas";
import {
  forbidden,
  getActor,
  invalid,
  notFound,
  serverError,
  unauthorized,
} from "@/lib/domain/workplace";

type Ctx = { params: Promise<{ id: string }> };

// Tick or untick a task. HR can do it for anyone in the company; an employee
// only for their own checklist.
export async function PATCH(request: Request, { params }: Ctx) {
  try {
    const actor = await getActor(request);
    if (!actor) return unauthorized();

    const { id } = await params;
    if (!isUuid(id)) return invalid("Invalid id");

    const parsed = onboardingTaskUpdateSchema.safeParse(await request.json());
    if (!parsed.success) return invalid(parsed.error.flatten());

    const [task] = await db
      .select()
      .from(onboardingTasks)
      .where(
        and(
          eq(onboardingTasks.id, id),
          eq(onboardingTasks.tenantId, actor.tenant.id),
        ),
      )
      .limit(1);

    if (!task) return notFound("Task");
    if (!actor.isHr && task.employeeId !== actor.employee.id) {
      return notFound("Task");
    }

    const [updated] = await db
      .update(onboardingTasks)
      .set({
        done: parsed.data.done,
        doneAt: parsed.data.done ? new Date() : null,
      })
      .where(eq(onboardingTasks.id, id))
      .returning();

    return NextResponse.json(updated);
  } catch (error) {
    return serverError("Onboarding update", error);
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
      .delete(onboardingTasks)
      .where(
        and(
          eq(onboardingTasks.id, id),
          eq(onboardingTasks.tenantId, actor.tenant.id),
        ),
      )
      .returning();

    if (!deleted) return notFound("Task");
    return NextResponse.json({ success: true });
  } catch (error) {
    return serverError("Onboarding delete", error);
  }
}
