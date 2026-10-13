import { NextResponse } from "next/server";
import { and, eq, gte, lte } from "drizzle-orm";

import { db } from "@/db";
import { employees, shiftAssignments, shifts } from "@/db/schema";
import { shiftAssignSchema } from "@/lib/validation/schemas";
import {
  forbidden,
  getActor,
  invalid,
  notFound,
  serverError,
  unauthorized,
} from "@/lib/domain/workplace";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

// ?from=YYYY-MM-DD&to=YYYY-MM-DD. HR sees everyone; an employee sees only
// their own roster.
export async function GET(request: Request) {
  try {
    const actor = await getActor(request);
    if (!actor) return unauthorized();

    const url = new URL(request.url);
    const from = url.searchParams.get("from") ?? "";
    const to = url.searchParams.get("to") ?? "";

    if (!DATE.test(from) || !DATE.test(to)) {
      return invalid("from and to must be YYYY-MM-DD");
    }

    const rows = await db
      .select()
      .from(shiftAssignments)
      .where(
        and(
          eq(shiftAssignments.tenantId, actor.tenant.id),
          gte(shiftAssignments.date, from),
          lte(shiftAssignments.date, to),
          actor.isHr ? undefined : eq(shiftAssignments.employeeId, actor.employee.id),
        ),
      );

    return NextResponse.json(rows);
  } catch (error) {
    return serverError("Roster fetch", error);
  }
}

// Assign (or clear, with shiftId: null) one employee's shift for one day.
export async function POST(request: Request) {
  try {
    const actor = await getActor(request);
    if (!actor) return unauthorized();
    if (!actor.isHr) return forbidden();

    const parsed = shiftAssignSchema.safeParse(await request.json());
    if (!parsed.success) return invalid(parsed.error.flatten());

    const { employeeId, shiftId, date } = parsed.data;

    const [employee] = await db
      .select({ id: employees.id })
      .from(employees)
      .where(
        and(eq(employees.id, employeeId), eq(employees.tenantId, actor.tenant.id)),
      )
      .limit(1);

    if (!employee) return notFound("Employee");

    if (shiftId === null) {
      await db
        .delete(shiftAssignments)
        .where(
          and(
            eq(shiftAssignments.employeeId, employeeId),
            eq(shiftAssignments.date, date),
            eq(shiftAssignments.tenantId, actor.tenant.id),
          ),
        );
      return NextResponse.json({ success: true });
    }

    const [shift] = await db
      .select({ id: shifts.id })
      .from(shifts)
      .where(and(eq(shifts.id, shiftId), eq(shifts.tenantId, actor.tenant.id)))
      .limit(1);

    if (!shift) return notFound("Shift");

    const [saved] = await db
      .insert(shiftAssignments)
      .values({ tenantId: actor.tenant.id, employeeId, shiftId, date })
      .onConflictDoUpdate({
        target: [shiftAssignments.employeeId, shiftAssignments.date],
        set: { shiftId },
      })
      .returning();

    return NextResponse.json(saved, { status: 201 });
  } catch (error) {
    return serverError("Roster update", error);
  }
}
