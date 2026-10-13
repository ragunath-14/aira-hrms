import { isUuid } from "@/lib/validation/ids";
import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import {
  employees,
  leaveBalances,
  leaveEncashmentRequests,
  notifications,
} from "@/db/schema";
import { isOwnEmployee, requireRole } from "@/lib/auth/authorization";
import { logAudit } from "@/lib/domain/audit";
import { approvalActionSchema } from "@/lib/validation/schemas";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireRole(request, [
      "owner",
      "admin",
      "hr",
      "manager",
    ]);

    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { id } = await params;
    if (!isUuid(id)) {
      return Response.json({ error: "Invalid id" }, { status: 400 });
    }
    const body = await request.json();
    const parsed = approvalActionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { action, comment } = parsed.data;

    const [encashment] = await db
      .select()
      .from(leaveEncashmentRequests)
      .where(
        and(
          eq(leaveEncashmentRequests.id, id),
          eq(leaveEncashmentRequests.tenantId, auth.tenant.id),
        ),
      )
      .limit(1);

    if (!encashment) {
      return NextResponse.json(
        { error: "Leave encashment request not found" },
        { status: 404 },
      );
    }

    if (encashment.status !== "pending") {
      return NextResponse.json(
        { error: "Only pending requests can be processed" },
        { status: 409 },
      );
    }

    if (await isOwnEmployee(encashment.employeeId, auth.user.id)) {
      return NextResponse.json(
        { error: "You cannot review your own leave encashment request" },
        { status: 403 },
      );
    }

    // Employee lookup and balance lookup are both independent of each
    // other — only the encashment row (already fetched) is needed for
    // either, so fetch them together.
    const [[employee], [balance]] = await Promise.all([
      db
        .select({ userId: employees.userId, firstName: employees.firstName })
        .from(employees)
        .where(and(eq(employees.id, encashment.employeeId), eq(employees.tenantId, auth.tenant.id)))
        .limit(1),
      action === "approve"
        ? db
            .select()
            .from(leaveBalances)
            .where(
              and(
                eq(leaveBalances.tenantId, auth.tenant.id),
                eq(leaveBalances.employeeId, encashment.employeeId),
                eq(leaveBalances.leaveTypeId, encashment.leaveTypeId),
                eq(leaveBalances.year, encashment.year),
              ),
            )
            .limit(1)
        : Promise.resolve([]),
    ]);

    if (action === "approve") {
      if (!balance || balance.remainingDays < encashment.daysRequested) {
        return NextResponse.json(
          { error: "Employee no longer has sufficient leave balance" },
          { status: 400 },
        );
      }
    }

    // The balance update (approve only) and the request-status update
    // are independent writes.
    const [, [updated]] = await Promise.all([
      action === "approve" && balance
        ? db
            .update(leaveBalances)
            .set({
              usedDays: balance.usedDays + encashment.daysRequested,
              remainingDays: balance.remainingDays - encashment.daysRequested,
              updatedAt: new Date(),
            })
            .where(eq(leaveBalances.id, balance.id))
        : Promise.resolve(),
      db
        .update(leaveEncashmentRequests)
        .set({
          status: action === "approve" ? "approved" : "rejected",
          managerComment: comment || null,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(leaveEncashmentRequests.id, id),
            eq(leaveEncashmentRequests.tenantId, auth.tenant.id),
          ),
        )
        .returning(),
    ]);

    await Promise.all([
      employee?.userId
        ? db.insert(notifications).values({
            tenantId: auth.tenant.id,
            userId: employee.userId,
            type: `leave_encashment_${action === "approve" ? "approved" : "rejected"}`,
            title: `Leave Encashment ${action === "approve" ? "Approved" : "Rejected"}`,
            message: `Your request to encash ${encashment.daysRequested} day(s) was ${action === "approve" ? "approved" : "rejected"}.${comment ? ` Comment: ${comment}` : ""}`,
            isRead: false,
          })
        : Promise.resolve(),
      logAudit({
        tenantId: auth.tenant.id,
        userId: auth.user.id,
        action: `leave_encashment_${action}d`,
        entity: "leave_encashment_request",
        entityId: id,
      }),
    ]);

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PATCH leave encashment error:", error);

    return NextResponse.json(
      { error: "Failed to process leave encashment request" },
      { status: 500 },
    );
  }
}
