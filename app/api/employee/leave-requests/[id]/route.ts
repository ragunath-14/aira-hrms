import { isUuid } from "@/lib/ids";
import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import {
  employees,
  leaveBalances,
  leaveRequests,
  notifications,
} from "@/db/schema";
import { getCurrentTenant } from "@/lib/authorization";
import { logAudit } from "@/lib/audit";

function todayUtcDateString() {
  return new Date().toISOString().slice(0, 10);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const context = await getCurrentTenant(request);

    if (!context) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { user, tenant } = context;
    const { id } = await params;
    if (!isUuid(id)) {
      return Response.json({ error: "Invalid id" }, { status: 400 });
    }

    const body = await request.json();

    if (body.action !== "cancel") {
      return NextResponse.json(
        { error: "action must be cancel" },
        { status: 400 },
      );
    }

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

    const [leaveRequest] = await db
      .select()
      .from(leaveRequests)
      .where(
        and(
          eq(leaveRequests.id, id),
          eq(leaveRequests.tenantId, tenant.id),
          eq(leaveRequests.employeeId, employee.id),
        ),
      )
      .limit(1);

    if (!leaveRequest) {
      return NextResponse.json(
        { error: "Leave request not found" },
        { status: 404 },
      );
    }

    if (leaveRequest.status !== "pending" && leaveRequest.status !== "approved") {
      return NextResponse.json(
        { error: "Only pending or approved leave requests can be cancelled" },
        { status: 409 },
      );
    }

    if (leaveRequest.status === "approved") {
      if (leaveRequest.startDate < todayUtcDateString()) {
        return NextResponse.json(
          { error: "Cannot cancel a leave request that has already started" },
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
            eq(leaveBalances.leaveTypeId, leaveRequest.leaveTypeId),
            eq(leaveBalances.year, new Date(leaveRequest.startDate).getUTCFullYear()),
          ),
        )
        .limit(1);

      if (balance) {
        await db
          .update(leaveBalances)
          .set({
            usedDays: Math.max(0, balance.usedDays - leaveRequest.totalDays),
            remainingDays: balance.remainingDays + leaveRequest.totalDays,
            updatedAt: new Date(),
          })
          .where(eq(leaveBalances.id, balance.id));
      }
    }

    const [updated] = await db
      .update(leaveRequests)
      .set({
        status: "cancelled",
        updatedAt: new Date(),
      })
      .where(and(eq(leaveRequests.id, id), eq(leaveRequests.tenantId, tenant.id)))
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
          type: "leave_cancelled",
          title: "Leave Request Cancelled",
          message: `${employee.firstName} ${employee.lastName ?? ""} cancelled their leave request from ${leaveRequest.startDate} to ${leaveRequest.endDate}.`,
          isRead: false,
        });
      }
    }

    await logAudit({
      tenantId: tenant.id,
      userId: user.id,
      action: "leave_cancelled",
      entity: "leave_request",
      entityId: id,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PATCH cancel leave request error:", error);

    return NextResponse.json(
      { error: "Failed to cancel leave request" },
      { status: 500 },
    );
  }
}
