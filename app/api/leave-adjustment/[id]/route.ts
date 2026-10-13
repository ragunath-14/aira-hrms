import { isUuid } from "@/lib/validation/ids";
import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import {
  employees,
  leaveAdjustmentRequests,
  leaveBalances,
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

    const [adjustment] = await db
      .select()
      .from(leaveAdjustmentRequests)
      .where(
        and(
          eq(leaveAdjustmentRequests.id, id),
          eq(leaveAdjustmentRequests.tenantId, auth.tenant.id),
        ),
      )
      .limit(1);

    if (!adjustment) {
      return NextResponse.json(
        { error: "Leave adjustment request not found" },
        { status: 404 },
      );
    }

    if (adjustment.status !== "pending") {
      return NextResponse.json(
        { error: "Only pending requests can be processed" },
        { status: 409 },
      );
    }

    if (await isOwnEmployee(adjustment.employeeId, auth.user.id)) {
      return NextResponse.json(
        { error: "You cannot review your own leave adjustment request" },
        { status: 403 },
      );
    }

    // Employee lookup and balance lookup are both independent of each
    // other — only the adjustment row (already fetched) is needed for
    // either, so fetch them together.
    const [[employee], [balance]] = await Promise.all([
      db
        .select({ userId: employees.userId })
        .from(employees)
        .where(and(eq(employees.id, adjustment.employeeId), eq(employees.tenantId, auth.tenant.id)))
        .limit(1),
      action === "approve"
        ? db
            .select()
            .from(leaveBalances)
            .where(
              and(
                eq(leaveBalances.tenantId, auth.tenant.id),
                eq(leaveBalances.employeeId, adjustment.employeeId),
                eq(leaveBalances.leaveTypeId, adjustment.leaveTypeId),
                eq(leaveBalances.year, adjustment.year),
              ),
            )
            .limit(1)
        : Promise.resolve([]),
    ]);

    let balanceWrite: Promise<unknown> = Promise.resolve();

    if (action === "approve") {
      if (balance) {
        const newRemaining = balance.remainingDays + adjustment.requestedDays;

        if (newRemaining < 0) {
          return NextResponse.json(
            { error: "Adjustment would leave a negative leave balance" },
            { status: 400 },
          );
        }

        balanceWrite = db
          .update(leaveBalances)
          .set({
            allocatedDays: balance.allocatedDays + adjustment.requestedDays,
            remainingDays: newRemaining,
            updatedAt: new Date(),
          })
          .where(eq(leaveBalances.id, balance.id));
      } else {
        if (adjustment.requestedDays < 0) {
          return NextResponse.json(
            { error: "No existing balance to reduce for this year" },
            { status: 400 },
          );
        }

        balanceWrite = db.insert(leaveBalances).values({
          tenantId: auth.tenant.id,
          employeeId: adjustment.employeeId,
          leaveTypeId: adjustment.leaveTypeId,
          year: adjustment.year,
          allocatedDays: adjustment.requestedDays,
          usedDays: 0,
          remainingDays: adjustment.requestedDays,
        });
      }
    }

    // The balance write (approve only) and the request-status update
    // are independent — run them together.
    const [, [updated]] = await Promise.all([
      balanceWrite,
      db
        .update(leaveAdjustmentRequests)
        .set({
          status: action === "approve" ? "approved" : "rejected",
          managerComment: comment || null,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(leaveAdjustmentRequests.id, id),
            eq(leaveAdjustmentRequests.tenantId, auth.tenant.id),
          ),
        )
        .returning(),
    ]);

    await Promise.all([
      employee?.userId
        ? db.insert(notifications).values({
            tenantId: auth.tenant.id,
            userId: employee.userId,
            type: `leave_adjustment_${action === "approve" ? "approved" : "rejected"}`,
            title: `Leave Adjustment ${action === "approve" ? "Approved" : "Rejected"}`,
            message: `Your ${adjustment.requestedDays > 0 ? "+" : ""}${adjustment.requestedDays} day adjustment request was ${action === "approve" ? "approved" : "rejected"}.${comment ? ` Comment: ${comment}` : ""}`,
            isRead: false,
          })
        : Promise.resolve(),
      logAudit({
        tenantId: auth.tenant.id,
        userId: auth.user.id,
        action: `leave_adjustment_${action}d`,
        entity: "leave_adjustment_request",
        entityId: id,
      }),
    ]);

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PATCH leave adjustment error:", error);

    return NextResponse.json(
      { error: "Failed to process leave adjustment request" },
      { status: 500 },
    );
  }
}
