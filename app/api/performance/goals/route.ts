import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { isUuid } from "@/lib/validation/ids";
import { requireRole } from "@/lib/auth/authorization";
import { db } from "@/db";
import {
  employees,
  performanceGoals,
} from "@/db/schema";

export async function GET(request: Request) {
  try {
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

    const canViewOthers = ["owner", "admin", "hr", "manager"].includes(
      auth.role,
    );

    const conditions = [eq(performanceGoals.tenantId, auth.tenant.id)];

    if (!canViewOthers) {
      const [employee] = await db
        .select({ id: employees.id })
        .from(employees)
        .where(
          and(
            eq(employees.userId, auth.user.id),
            eq(employees.tenantId, auth.tenant.id),
          ),
        )
        .limit(1);

      if (!employee) {
        return NextResponse.json([]);
      }

      conditions.push(eq(performanceGoals.employeeId, employee.id));
    }

    const goals = await db
      .select()
      .from(performanceGoals)
      .where(and(...conditions));

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

    if (!employeeId || typeof title !== "string" || !title.trim()) {
      return NextResponse.json(
        {
          error:
            "employeeId and title are required",
        },
        { status: 400 },
      );
    }

    if (title.trim().length > 150) {
      return NextResponse.json(
        { error: "Goal title must be at most 150 characters" },
        { status: 400 },
      );
    }

    if (description != null && (typeof description !== "string" || description.length > 1000)) {
      return NextResponse.json(
        { error: "Description must be text of at most 1000 characters" },
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
            auth.tenant.id,
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
      auth.role,
    );

    if (!canManageOthers && employee.userId !== auth.user.id) {
      return NextResponse.json(
        { error: "You can only create goals for yourself" },
        { status: 403 },
      );
    }

    const [goal] = await db
      .insert(performanceGoals)
      .values({
        tenantId: auth.tenant.id,
        employeeId,
        title: title.trim(),
        description: description?.trim() || null,
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
            auth.tenant.id,
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
      auth.role,
    );

    if (!canManageOthers && existingGoal.employeeUserId !== auth.user.id) {
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
            auth.tenant.id,
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


export async function DELETE(request: Request) {
  try {
    const auth = await requireRole(request, ["owner", "admin", "hr"]);

    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const id = new URL(request.url).searchParams.get("id");

    if (!id || !isUuid(id)) {
      return NextResponse.json({ error: "A valid id query param is required" }, { status: 400 });
    }

    const [deleted] = await db
      .delete(performanceGoals)
      .where(and(eq(performanceGoals.id, id), eq(performanceGoals.tenantId, auth.tenant.id)))
      .returning({ id: performanceGoals.id });

    if (!deleted) {
      return NextResponse.json({ error: "Goal not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Goal DELETE error:", error);
    return NextResponse.json({ error: "Failed to delete goal" }, { status: 500 });
  }
}
