import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { employees, leavePlans, leaveTypes } from "@/db/schema";
import { getCurrentTenant } from "@/lib/auth/authorization";
import { leavePlanCreateSchema } from "@/lib/validation/schemas";

export async function GET(request: Request) {
  try {
    const context = await getCurrentTenant(request);

    if (!context) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { user, tenant } = context;

    const [employee] = await db
      .select({ id: employees.id })
      .from(employees)
      .where(and(eq(employees.userId, user.id), eq(employees.tenantId, tenant.id)))
      .limit(1);

    if (!employee) {
      return NextResponse.json(
        { error: "Employee record not found" },
        { status: 404 },
      );
    }

    const plans = await db
      .select({
        id: leavePlans.id,
        leaveTypeId: leavePlans.leaveTypeId,
        leaveType: leaveTypes.name,
        startDate: leavePlans.startDate,
        endDate: leavePlans.endDate,
        note: leavePlans.note,
        status: leavePlans.status,
        createdAt: leavePlans.createdAt,
      })
      .from(leavePlans)
      .leftJoin(
        leaveTypes,
        and(
          eq(leavePlans.leaveTypeId, leaveTypes.id),
          eq(leaveTypes.tenantId, tenant.id),
        ),
      )
      .where(
        and(
          eq(leavePlans.employeeId, employee.id),
          eq(leavePlans.tenantId, tenant.id),
        ),
      )
      .orderBy(desc(leavePlans.startDate));

    return NextResponse.json(plans);
  } catch (error) {
    console.error("GET leave plans error:", error);

    return NextResponse.json(
      { error: "Failed to fetch leave plans" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const context = await getCurrentTenant(request);

    if (!context) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { user, tenant } = context;

    const [employee] = await db
      .select()
      .from(employees)
      .where(and(eq(employees.userId, user.id), eq(employees.tenantId, tenant.id)))
      .limit(1);

    if (!employee) {
      return NextResponse.json(
        { error: "Employee record not found" },
        { status: 404 },
      );
    }

    const body = await request.json();
    const parsed = leavePlanCreateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { leaveTypeId, startDate, endDate, note } = parsed.data;

    if (new Date(`${endDate}T00:00:00Z`) < new Date(`${startDate}T00:00:00Z`)) {
      return NextResponse.json(
        { error: "endDate cannot be before startDate" },
        { status: 400 },
      );
    }

    if (leaveTypeId) {
      const [leaveType] = await db
        .select({ id: leaveTypes.id })
        .from(leaveTypes)
        .where(and(eq(leaveTypes.id, leaveTypeId), eq(leaveTypes.tenantId, tenant.id)))
        .limit(1);

      if (!leaveType) {
        return NextResponse.json(
          { error: "Leave type not found" },
          { status: 404 },
        );
      }
    }

    const [created] = await db
      .insert(leavePlans)
      .values({
        tenantId: tenant.id,
        employeeId: employee.id,
        leaveTypeId: leaveTypeId ?? null,
        startDate,
        endDate,
        note: note ?? null,
        status: "planned",
      })
      .returning();

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error("POST leave plan error:", error);

    return NextResponse.json(
      { error: "Failed to create leave plan" },
      { status: 500 },
    );
  }
}
