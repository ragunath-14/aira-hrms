import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/authorization";
import { db } from "@/db";
import {
  employees,
  performanceGoals,
} from "@/db/schema";
import { getCurrentTenant } from "@/lib/authorization";

export async function GET(request: Request) {
  try {
    const context = await getCurrentTenant(request);

    if (!context) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 },
      );
    }
    const auth = await requireRole(request, [
  "owner",
  "admin",
  "hr",
  "manager",
  "employee",
]);

if (!auth.authorized) {
  return NextResponse.json(
    { error: auth.error },
    { status: auth.status },
  );
}

    const goals = await db
      .select()
      .from(performanceGoals)
      .where(
        eq(
          performanceGoals.tenantId,
          context.tenant.id,
        ),
      );

    return NextResponse.json(goals);
  } catch (error) {
    console.error(
      "GET performance goals error:",
      error,
    );

    return NextResponse.json(
      { error: "Failed to fetch performance goals" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const context = await getCurrentTenant(request);

    if (!context) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 },
      );
    }
const auth = await requireRole(request, [
  "owner",
  "admin",
  "hr",
  "manager",
  "employee",
]);

if (!auth.authorized) {
  return NextResponse.json(
    { error: auth.error },
    { status: auth.status },
  );
}
    const body = await request.json();

    const {
      employeeId,
      title,
      description,
      status,
    } = body;

    if (!employeeId || !title) {
      return NextResponse.json(
        {
          error:
            "employeeId and title are required",
        },
        { status: 400 },
      );
    }

    const [employee] = await db
      .select({
        id: employees.id,
        userId: employees.userId,
      })
      .from(employees)
      .where(
        and(
          eq(employees.id, employeeId),
          eq(
            employees.tenantId,
            context.tenant.id,
          ),
        ),
      )
      .limit(1);

    if (!employee) {
      return NextResponse.json(
        { error: "Employee not found" },
        { status: 404 },
      );
    }

    const canManageOthers = ["owner", "admin", "hr", "manager"].includes(
      context.membership.role,
    );

    if (!canManageOthers && employee.userId !== context.user.id) {
      return NextResponse.json(
        { error: "You can only create goals for yourself" },
        { status: 403 },
      );
    }

    const [goal] = await db
      .insert(performanceGoals)
      .values({
        tenantId: context.tenant.id,
        employeeId,
        title,
        description: description ?? null,
        status: status || "active",
      })
      .returning();

    return NextResponse.json(goal, {
      status: 201,
    });
  } catch (error) {
    console.error(
      "POST performance goal error:",
      error,
    );

    return NextResponse.json(
      { error: "Failed to create performance goal" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const context = await getCurrentTenant(request);

    if (!context) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 },
      );
    }
    const auth = await requireRole(request, [
  "owner",
  "admin",
  "hr",
  "manager",
  "employee",
]);

if (!auth.authorized) {
  return NextResponse.json(
    { error: auth.error },
    { status: auth.status },
  );
}

    const body = await request.json();

    const {
      id,
      title,
      description,
      status,
    } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Goal id is required" },
        { status: 400 },
      );
    }

    const [existingGoal] = await db
      .select({
        id: performanceGoals.id,
        title: performanceGoals.title,
        description: performanceGoals.description,
        employeeUserId: employees.userId,
      })
      .from(performanceGoals)
      .innerJoin(
        employees,
        eq(performanceGoals.employeeId, employees.id),
      )
      .where(
        and(
          eq(performanceGoals.id, id),
          eq(
            performanceGoals.tenantId,
            context.tenant.id,
          ),
        ),
      )
      .limit(1);

    if (!existingGoal) {
      return NextResponse.json(
        { error: "Performance goal not found" },
        { status: 404 },
      );
    }

    const canManageOthers = ["owner", "admin", "hr", "manager"].includes(
      context.membership.role,
    );

    if (!canManageOthers && existingGoal.employeeUserId !== context.user.id) {
      return NextResponse.json(
        { error: "You can only update your own goals" },
        { status: 403 },
      );
    }

    // A non-manager caller can only progress their own goal's status,
    // not redefine its title/description.
    const nextTitle = canManageOthers
      ? title ?? existingGoal.title
      : existingGoal.title;
    const nextDescription = canManageOthers
      ? (description ?? existingGoal.description)
      : existingGoal.description;

    const [updatedGoal] = await db
      .update(performanceGoals)
      .set({
        title: nextTitle,
        description: nextDescription,
        status: status || "active",
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(performanceGoals.id, id),
          eq(
            performanceGoals.tenantId,
            context.tenant.id,
          ),
        ),
      )
      .returning();

    return NextResponse.json(updatedGoal);
  } catch (error) {
    console.error(
      "PATCH performance goal error:",
      error,
    );

    return NextResponse.json(
      { error: "Failed to update performance goal" },
      { status: 500 },
    );
  }
}