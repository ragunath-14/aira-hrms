import { isUuid } from "@/lib/validation/ids";
import { and, eq } from "drizzle-orm";
import { requireRole } from "@/lib/auth/authorization";
import { NextResponse } from "next/server";
import { db } from "@/db";
import {
  leaveBalances,
  leaveRequests,
} from "@/db/schema/leaves";
import { employees } from "@/db/schema/employees";
import { notifications } from "@/db/schema/notifications";
import { logAudit } from "@/lib/domain/audit";

export async function PATCH(
  request: Request,
  context: {
    params: Promise<{ id: string }>;
  },
) {
  try {
    const auth = await requireRole(request, [
      "owner",
      "admin",
      "hr",
      "manager",
    ]);

    if (!auth.authorized) {
      return NextResponse.json(
        { error: auth.error },
        { status: auth.status },
      );
    }

    const { id } = await context.params;
    if (!isUuid(id)) {
      return Response.json({ error: "Invalid id" }, { status: 400 });
    }

    const body = await request.json();

    const action = body.action;

    if (
      action !== "approve" &&
      action !== "reject"
    ) {
      return Response.json(
        {
          error:
            "action must be approve or reject",
        },
        { status: 400 },
      );
    }

    const [leaveRequest] = await db
      .select()
      .from(leaveRequests)
      .where(
        and(
          eq(leaveRequests.id, id),
          eq(
            leaveRequests.tenantId,
            auth.tenant.id,
          ),
        ),
      )
      .limit(1);

    if (!leaveRequest) {
      return Response.json(
        {
          error: "Leave request not found",
        },
        { status: 404 },
      );
    }

    if (leaveRequest.status !== "pending") {
      return Response.json(
        {
          error:
            "Only pending leave requests can be processed",
        },
        { status: 409 },
      );
    }

    // Nobody reviews their own request, and the approver is recorded.
    const [[requester], [approver]] = await Promise.all([
      db
        .select({ userId: employees.userId })
        .from(employees)
        .where(eq(employees.id, leaveRequest.employeeId))
        .limit(1),
      db
        .select({ id: employees.id })
        .from(employees)
        .where(
          and(
            eq(employees.userId, auth.user.id),
            eq(employees.tenantId, auth.tenant.id),
          ),
        )
        .limit(1),
    ]);

    if (requester?.userId && requester.userId === auth.user.id) {
      return Response.json(
        { error: "You cannot review your own leave request" },
        { status: 403 },
      );
    }

    const approverEmployeeId = approver?.id ?? null;

    if (action === "reject") {
      // The update and the employee lookup are independent of each
      // other (both only need leaveRequest, already in hand) — running
      // them in parallel instead of sequentially halves the DB
      // round-trips on this path, which matters a lot under real
      // network latency to the database.
      const [[updated], [employee]] = await Promise.all([
        db
          .update(leaveRequests)
          .set({
            status: "rejected",
            managerId: approverEmployeeId,
            managerComment:
              body.comment?.trim() || null,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(
                leaveRequests.id,
                id,
              ),
              eq(
                leaveRequests.tenantId,
                auth.tenant.id,
              ),
            ),
          )
          .returning(),
        db
          .select({
            userId: employees.userId,
          })
          .from(employees)
          .where(
            and(
              eq(
                employees.id,
                leaveRequest.employeeId,
              ),
              eq(
                employees.tenantId,
                auth.tenant.id,
              ),
            ),
          )
          .limit(1),
      ]);

      await Promise.all([
        employee?.userId
          ? db.insert(notifications).values({
              tenantId:
                auth.tenant.id,
              userId:
                employee.userId,
              type: "leave_rejected",
              title: "Leave Request Rejected",
              message: `Your leave request from ${leaveRequest.startDate} to ${leaveRequest.endDate} was rejected.${body.comment?.trim() ? ` Comment: ${body.comment.trim()}` : ""}`,
              isRead: false,
            })
          : Promise.resolve(),
        logAudit({
          tenantId: auth.tenant.id,
          userId: auth.user.id,
          action: "leave_rejected",
          entity: "leave_request",
          entityId: id,
        }),
      ]);

      return Response.json(updated);
    }

    // The balance lookup and the employee lookup (needed later for the
    // notification) are both independent of each other — fetch them
    // together instead of one-after-another.
    const [[balance], [employeeForNotification]] = await Promise.all([
      db
        .select()
        .from(leaveBalances)
        .where(
          and(
            eq(
              leaveBalances.tenantId,
              auth.tenant.id,
            ),
            eq(
              leaveBalances.employeeId,
              leaveRequest.employeeId,
            ),
            eq(
              leaveBalances.leaveTypeId,
              leaveRequest.leaveTypeId,
            ),
            eq(
              leaveBalances.year,
              new Date(
                leaveRequest.startDate,
              ).getUTCFullYear(),
            ),
          ),
        )
        .limit(1),
      db
        .select({
          userId: employees.userId,
        })
        .from(employees)
        .where(
          and(
            eq(
              employees.id,
              leaveRequest.employeeId,
            ),
            eq(
              employees.tenantId,
              auth.tenant.id,
            ),
          ),
        )
        .limit(1),
    ]);

    if (!balance) {
      return Response.json(
        {
          error:
            "Leave balance not found",
        },
        { status: 400 },
      );
    }

    if (
      balance.remainingDays <
      leaveRequest.totalDays
    ) {
      return Response.json(
        {
          error:
            "Insufficient remaining leave balance",
        },
        { status: 400 },
      );
    }

    const newUsedDays =
      balance.usedDays +
      leaveRequest.totalDays;

    const newRemainingDays =
      balance.remainingDays -
      leaveRequest.totalDays;

    // Both updates are independent writes — no need to wait for one
    // before starting the other.
    const [, [updated]] = await Promise.all([
      db
        .update(leaveBalances)
        .set({
          usedDays: newUsedDays,
          remainingDays:
            newRemainingDays,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(
              leaveBalances.id,
              balance.id,
            ),
            eq(
              leaveBalances.tenantId,
              auth.tenant.id,
            ),
          ),
        ),
      db
        .update(leaveRequests)
        .set({
          status: "approved",
          managerId: approverEmployeeId,
          managerComment:
            body.comment?.trim() || null,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(
              leaveRequests.id,
              id,
            ),
            eq(
              leaveRequests.tenantId,
              auth.tenant.id,
            ),
          ),
        )
        .returning(),
    ]);

    await Promise.all([
      employeeForNotification?.userId
        ? db.insert(notifications).values({
            tenantId:
              auth.tenant.id,
            userId:
              employeeForNotification.userId,
            type: "leave_approved",
            title: "Leave Request Approved",
            message: `Your leave request from ${leaveRequest.startDate} to ${leaveRequest.endDate} has been approved.`,
            isRead: false,
          })
        : Promise.resolve(),
      logAudit({
        tenantId: auth.tenant.id,
        userId: auth.user.id,
        action: "leave_approved",
        entity: "leave_request",
        entityId: id,
      }),
    ]);

    return Response.json(updated);
  } catch (error) {
    console.error(
      "Leave approval/rejection error:",
      error,
    );

    return Response.json(
      { error: "Failed to process leave request" },
      { status: 500 },
    );
  }
}


// HR removes a leave request. If it was approved, the days it used are given
// back to the employee's balance so nothing is lost silently.
export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireRole(request, ["owner", "admin", "hr"]);

    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { id } = await context.params;
    if (!isUuid(id)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const [existing] = await db
      .select()
      .from(leaveRequests)
      .where(and(eq(leaveRequests.id, id), eq(leaveRequests.tenantId, auth.tenant.id)))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: "Leave request not found" }, { status: 404 });
    }

    if (existing.status === "approved") {
      const [balance] = await db
        .select()
        .from(leaveBalances)
        .where(
          and(
            eq(leaveBalances.tenantId, auth.tenant.id),
            eq(leaveBalances.employeeId, existing.employeeId),
            eq(leaveBalances.leaveTypeId, existing.leaveTypeId),
            eq(leaveBalances.year, new Date(existing.startDate).getUTCFullYear()),
          ),
        )
        .limit(1);

      if (balance) {
        await db
          .update(leaveBalances)
          .set({
            usedDays: Math.max(0, balance.usedDays - existing.totalDays),
            remainingDays: balance.remainingDays + existing.totalDays,
            updatedAt: new Date(),
          })
          .where(eq(leaveBalances.id, balance.id));
      }
    }

    await db.delete(leaveRequests).where(eq(leaveRequests.id, id));

    await logAudit({
      tenantId: auth.tenant.id,
      userId: auth.user.id,
      action: "leave_request_deleted",
      entity: "leave_request",
      entityId: id,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Leave request DELETE error:", error);
    return NextResponse.json({ error: "Failed to delete leave request" }, { status: 500 });
  }
}
