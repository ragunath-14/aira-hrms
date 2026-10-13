import { NextResponse } from "next/server";
import { and, asc, eq } from "drizzle-orm";

import { db } from "@/db";
import { employees, onboardingTasks } from "@/db/schema";
import { logAudit } from "@/lib/domain/audit";
import { createNotification } from "@/lib/domain/notifications";
import {
  onboardingStartSchema,
  onboardingTaskCreateSchema,
} from "@/lib/validation/schemas";
import {
  forbidden,
  getActor,
  invalid,
  notFound,
  serverError,
  unauthorized,
} from "@/lib/domain/workplace";

const DEFAULT_TASKS: Record<"onboarding" | "offboarding", string[]> = {
  onboarding: [
    "Sign offer letter and employment contract",
    "Submit ID proof and bank details",
    "Collect laptop and access card",
    "Set up email and company accounts",
    "Complete HR policy induction",
    "Meet your manager and team",
    "Finish first-week training",
  ],
  offboarding: [
    "Submit resignation acceptance",
    "Hand over ongoing work",
    "Return laptop and access card",
    "Revoke system and email access",
    "Clear pending expense claims",
    "Complete exit interview",
    "Process full and final settlement",
  ],
};

export async function GET(request: Request) {
  try {
    const actor = await getActor(request);
    if (!actor) return unauthorized();

    const rows = await db
      .select({
        task: onboardingTasks,
        firstName: employees.firstName,
        lastName: employees.lastName,
        employeeCode: employees.employeeCode,
      })
      .from(onboardingTasks)
      .innerJoin(employees, eq(employees.id, onboardingTasks.employeeId))
      .where(
        actor.isHr
          ? eq(onboardingTasks.tenantId, actor.tenant.id)
          : and(
              eq(onboardingTasks.tenantId, actor.tenant.id),
              eq(onboardingTasks.employeeId, actor.employee.id),
            ),
      )
      .orderBy(asc(onboardingTasks.createdAt));

    return NextResponse.json(
      rows.map((r) => ({
        ...r.task,
        employeeName: [r.firstName, r.lastName].filter(Boolean).join(" "),
        employeeCode: r.employeeCode,
      })),
    );
  } catch (error) {
    return serverError("Onboarding fetch", error);
  }
}

// HR either starts the standard checklist for an employee ({employeeId, kind})
// or adds a single custom task ({employeeId, title, dueDate?}).
export async function POST(request: Request) {
  try {
    const actor = await getActor(request);
    if (!actor) return unauthorized();
    if (!actor.isHr) return forbidden();

    const body = await request.json();
    const custom = typeof body?.title === "string";

    const parsed = custom
      ? onboardingTaskCreateSchema.safeParse(body)
      : onboardingStartSchema.safeParse(body);

    if (!parsed.success) return invalid(parsed.error.flatten());

    const [employee] = await db
      .select({ id: employees.id, userId: employees.userId })
      .from(employees)
      .where(
        and(
          eq(employees.id, parsed.data.employeeId),
          eq(employees.tenantId, actor.tenant.id),
        ),
      )
      .limit(1);

    if (!employee) return notFound("Employee");

    const kind = parsed.data.kind;
    const titles = custom
      ? [String(body.title).trim()]
      : DEFAULT_TASKS[kind];

    if (!custom) {
      const [existing] = await db
        .select({ id: onboardingTasks.id })
        .from(onboardingTasks)
        .where(
          and(
            eq(onboardingTasks.employeeId, employee.id),
            eq(onboardingTasks.kind, kind),
          ),
        )
        .limit(1);

      if (existing) {
        return NextResponse.json(
          { error: `${kind === "onboarding" ? "An" : "An"} ${kind} checklist already exists for this employee` },
          { status: 409 },
        );
      }
    }

    const created = await db
      .insert(onboardingTasks)
      .values(
        titles.map((title, index) => ({
          tenantId: actor.tenant.id,
          employeeId: employee.id,
          kind,
          title,
          dueDate: custom ? (body.dueDate ?? null) : null,
          // Distinct timestamps keep the checklist in the order it was written.
          createdAt: new Date(Date.now() + index),
        })),
      )
      .returning();

    if (!custom && employee.userId) {
      await createNotification({
        tenantId: actor.tenant.id,
        userId: employee.userId,
        type: "onboarding",
        title: kind === "onboarding" ? "Onboarding checklist ready" : "Offboarding checklist ready",
        message: `${created.length} tasks were assigned to you. Open Onboarding to start.`,
      });
    }

    await logAudit({
      tenantId: actor.tenant.id,
      userId: actor.user.id,
      action: custom ? "onboarding_task_added" : `${kind}_started`,
      entity: "employee",
      entityId: employee.id,
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return serverError("Onboarding create", error);
  }
}
