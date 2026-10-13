import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";

import { db } from "@/db";
import {
  employees,
  leaveBalances,
  leaveEncashmentRequests,
  leaveTypes,
  notifications,
} from "@/db/schema";
import { getCurrentTenant } from "@/lib/auth/authorization";
import { leaveEncashmentCreateSchema } from "@/lib/validation/schemas";

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
        id: leaveEncashmentRequests.id,
        leaveTypeId: leaveEncashmentRequests.leaveTypeId,
        leaveType: leaveTypes.name,
        year: leaveEncashmentRequests.year,
        daysRequested: leaveEncashmentRequests.daysRequested,
        reason: leaveEncashmentRequests.reason,
        status: leaveEncashmentRequests.status,
        managerComment: leaveEncashmentRequests.managerComment,
        createdAt: leaveEncashmentRequests.createdAt,
      })
      .from(leaveEncashmentRequests)
      .leftJoin(leaveTypes, eq(leaveEncashmentRequests.leaveTypeId, leaveTypes.id))
      .where(
        and(
          eq(leaveEncashmentRequests.employeeId, employee.id),
          eq(leaveEncashmentRequests.tenantId, tenant.id),
        ),
      )
      .orderBy(desc(leaveEncashmentRequests.createdAt));

    return NextResponse.json(requests);
  } catch (error) {
    console.error("GET leave encashment error:", error);

    return NextResponse.json(
      { error: "Failed to fetch leave encashment requests" },
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
    const parsed = leaveEncashmentCreateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { leaveTypeId, year, daysRequested, reason } = parsed.data;

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

    if (!leaveType.encashmentAllowed) {
      return NextResponse.json(
        { error: "This leave type does not allow encashment" },
        { status: 400 },
      );
    }

    const [balance] = await db
      .select()
      .from(leaveBalances)
      .where(
        and(
          eq(leaveBalances.tenantId, tenant.id),
          eq(leaveBalances.employeeId, employee.id),
          eq(leaveBalances.leaveTypeId, leaveTypeId),
          eq(leaveBalances.year, year),
        ),
      )
      .limit(1);

    if (!balance || balance.remainingDays < daysRequested) {
      return NextResponse.json(
        { error: "Insufficient leave balance for encashment" },
        { status: 400 },
      );
    }

    const [created] = await db
      .insert(leaveEncashmentRequests)
      .values({
        tenantId: tenant.id,
        employeeId: employee.id,
        leaveTypeId,
        year,
        daysRequested,
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
          type: "leave_encashment_submitted",
          title: "New Leave Encashment Request",
          message: `${employee.firstName} ${employee.lastName ?? ""} requested to encash ${daysRequested} day(s) of ${leaveType.name}.`,
          isRead: false,
        });
      }
    }

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error("POST leave encashment error:", error);

    return NextResponse.json(
      { error: "Failed to create leave encashment request" },
      { status: 500 },
    );
  }
}
