import { and, eq } from "drizzle-orm";
import { requireRole } from "@/lib/authorization";
import { NextResponse } from "next/server";
import { db } from "@/db";
import {
  leaveBalances,
  leaveRequests,
} from "@/db/schema/leaves";
import { employees } from "@/db/schema/employees";
import { notifications } from "@/db/schema/notifications";
import { logAudit } from "@/lib/audit";

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

    if (action === "reject") {
      const [updated] = await db
        .update(leaveRequests)
        .set({
          status: "rejected",
          managerId: null,
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
        .returning();

      const [employee] = await db
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
        .limit(1);

      if (employee?.userId) {
        await db.insert(notifications).values({
          tenantId:
            auth.tenant.id,
          userId:
            employee.userId,
          type: "leave_rejected",
          title: "Leave Request Rejected",
          message: `Your leave request from ${leaveRequest.startDate} to ${leaveRequest.endDate} was rejected.${body.comment?.trim() ? ` Comment: ${body.comment.trim()}` : ""}`,
          isRead: false,
        });
      }

      await logAudit({
        tenantId: auth.tenant.id,
        userId: auth.user.id,
        action: "leave_rejected",
        entity: "leave_request",
        entityId: id,
      });

      return Response.json(updated);
    }

    const [balance] = await db
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
      .limit(1);

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

    await db
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
      );

    const [updated] = await db
      .update(leaveRequests)
      .set({
        status: "approved",
        managerId: null,
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
      .returning();

    const [employee] = await db
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
      .limit(1);

    if (employee?.userId) {
      await db.insert(notifications).values({
        tenantId:
          auth.tenant.id,
        userId:
          employee.userId,
        type: "leave_approved",
        title: "Leave Request Approved",
        message: `Your leave request from ${leaveRequest.startDate} to ${leaveRequest.endDate} has been approved.`,
        isRead: false,
      });
    }

    await logAudit({
      tenantId: auth.tenant.id,
      userId: auth.user.id,
      action: "leave_approved",
      entity: "leave_request",
      entityId: id,
    });

    return Response.json(updated);
  } catch (error) {
    console.error(
      "Leave approval/rejection error:",
      error,
    );

    return Response.json(
      {
        error: "Failed to process leave request",
        details:
          error instanceof Error
            ? error.message
            : String(error),
      },
      { status: 500 },
    );
  }
}
