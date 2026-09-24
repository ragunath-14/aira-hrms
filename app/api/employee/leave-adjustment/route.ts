import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";

import { db } from "@/db";
import {
  employees,
  leaveAdjustmentRequests,
  leaveTypes,
  notifications,
} from "@/db/schema";
import { getCurrentTenant } from "@/lib/authorization";
import { leaveAdjustmentCreateSchema } from "@/lib/validations";

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

    const requests = await db
      .select({
        id: leaveAdjustmentRequests.id,
        leaveTypeId: leaveAdjustmentRequests.leaveTypeId,
        leaveType: leaveTypes.name,
        year: leaveAdjustmentRequests.year,
        requestedDays: leaveAdjustmentRequests.requestedDays,
        reason: leaveAdjustmentRequests.reason,
        status: leaveAdjustmentRequests.status,
        managerComment: leaveAdjustmentRequests.managerComment,
        createdAt: leaveAdjustmentRequests.createdAt,
      })
      .from(leaveAdjustmentRequests)
      .leftJoin(leaveTypes, eq(leaveAdjustmentRequests.leaveTypeId, leaveTypes.id))
      .where(
        and(
          eq(leaveAdjustmentRequests.employeeId, employee.id),
          eq(leaveAdjustmentRequests.tenantId, tenant.id),
        ),
      )
      .orderBy(desc(leaveAdjustmentRequests.createdAt));

    return NextResponse.json(requests);
  } catch (error) {
    console.error("GET leave adjustment error:", error);

    return NextResponse.json(
      { error: "Failed to fetch leave adjustment requests" },
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
    const parsed = leaveAdjustmentCreateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { leaveTypeId, year, requestedDays, reason } = parsed.data;

    const [leaveType] = await db
      .select()
      .from(leaveTypes)
      .where(and(eq(leaveTypes.id, leaveTypeId), eq(leaveTypes.tenantId, tenant.id)))
      .limit(1);

    if (!leaveType) {
      return NextResponse.json(
        { error: "Leave type not found" },
        { status: 404 },
      );
    }

    const [created] = await db
      .insert(leaveAdjustmentRequests)
      .values({
        tenantId: tenant.id,
        employeeId: employee.id,
        leaveTypeId,
        year,
        requestedDays,
        reason: reason ?? null,
        status: "pending",
        managerId: employee.managerId ?? null,
      })
      .returning();

    if (employee.managerId) {
      const [manager] = await db
        .select({ userId: employees.userId })
        .from(employees)
        .where(and(eq(employees.id, employee.managerId), eq(employees.tenantId, tenant.id)))
        .limit(1);

      if (manager?.userId) {
        await db.insert(notifications).values({
          tenantId: tenant.id,
          userId: manager.userId,
          type: "leave_adjustment_submitted",
          title: "New Leave Adjustment Request",
          message: `${employee.firstName} ${employee.lastName ?? ""} requested a ${requestedDays > 0 ? "+" : ""}${requestedDays} day adjustment to ${leaveType.name}.`,
          isRead: false,
        });
      }
    }

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error("POST leave adjustment error:", error);

    return NextResponse.json(
      { error: "Failed to create leave adjustment request" },
      { status: 500 },
    );
  }
}
