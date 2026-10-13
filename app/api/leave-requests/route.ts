import { isUuid } from "@/lib/validation/ids";
import { and, eq, gte, inArray, lte } from "drizzle-orm";
import { requireRole } from "@/lib/auth/authorization";
import { ensureLeaveBalances } from "@/lib/domain/leave-balances";
import { countLeaveDays } from "@/lib/domain/leave-days";
import { resolveSettings } from "@/lib/config/settings";
import { NextResponse } from "next/server";
import { db } from "@/db";
import {
  leaveBalances,
  leaveRequests,
  leaveTypes,
} from "@/db/schema/leaves";
import { employees } from "@/db/schema/employees";
import { notifications } from "@/db/schema/notifications";
import { logAudit } from "@/lib/domain/audit";
import { createNotification } from "@/lib/domain/notifications";
import { leaveRequestCreateSchema } from "@/lib/validation/schemas";

function daysFromToday(dateStr: string) {
  const target = new Date(`${dateStr}T00:00:00Z`);
  const now = new Date();
  const todayUTC = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  );
  const millisecondsPerDay = 1000 * 60 * 60 * 24;

  return Math.round((target.getTime() - todayUTC) / millisecondsPerDay);
}

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

    const { searchParams } = new URL(request.url);

    const employeeId = searchParams.get("employeeId");

    if (employeeId && !isUuid(employeeId)) {
      return Response.json(
        { error: "Invalid employeeId" },
        { status: 400 },
      );
    }
    const status = searchParams.get("status");

    const canViewOthers = ["owner", "admin", "hr", "manager"].includes(
      auth.role,
    );

    let targetEmployeeId: string | null = null;

    if (!employeeId && canViewOthers) {
      // HR/manager/owner fetching the whole tenant's requests in one call.
      targetEmployeeId = null;
    } else if (employeeId && canViewOthers) {
      const [employee] = await db
        .select({ id: employees.id })
        .from(employees)
        .where(
          and(
            eq(employees.id, employeeId),
            eq(employees.tenantId, auth.tenant.id),
          ),
        )
        .limit(1);

      if (!employee) {
        return Response.json(
          { error: "Employee not found" },
          { status: 404 },
        );
      }

      targetEmployeeId = employee.id;
    } else {
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

      if (employee) {
        targetEmployeeId = employee.id;
      }
    }

    const conditions = [eq(leaveRequests.tenantId, auth.tenant.id)];

    if (targetEmployeeId) {
      conditions.push(eq(leaveRequests.employeeId, targetEmployeeId));
    }

    if (status) {
      conditions.push(eq(leaveRequests.status, status));
    }

    const requests = await db
      .select({
        id: leaveRequests.id,
        employeeId: leaveRequests.employeeId,
        leaveTypeId: leaveRequests.leaveTypeId,
        leaveType: leaveTypes.name,
        startDate: leaveRequests.startDate,
        endDate: leaveRequests.endDate,
        totalDays: leaveRequests.totalDays,
        reason: leaveRequests.reason,
        status: leaveRequests.status,
        managerId: leaveRequests.managerId,
        managerComment: leaveRequests.managerComment,
        createdAt: leaveRequests.createdAt,
        updatedAt: leaveRequests.updatedAt,
      })
      .from(leaveRequests)
      .innerJoin(leaveTypes, eq(leaveRequests.leaveTypeId, leaveTypes.id))
      .where(and(...conditions));

    return Response.json(requests);
  } catch (error) {
    console.error("Leave requests GET error:", error);

    return Response.json(
      { error: "Failed to fetch leave requests" },
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

    const parsed = leaveRequestCreateSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        { error: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { leaveTypeId, startDate, endDate, reason } = parsed.data;

    const totalDays = await countLeaveDays(
      auth.tenant.id,
      startDate,
      endDate,
      resolveSettings(auth.tenant.settings),
    );

    if (totalDays === null) {
      return Response.json(
        { error: "Invalid leave date range" },
        { status: 400 },
      );
    }

    if (totalDays === 0) {
      return Response.json(
        { error: "The selected dates are all weekends or holidays, so no leave is needed" },
        { status: 400 },
      );
    }

    const [employee] = await db
      .select()
      .from(employees)
      .where(
        and(
          eq(employees.userId, auth.user.id),
          eq(employees.tenantId, auth.tenant.id),
        ),
      )
      .limit(1);

    if (!employee) {
      return Response.json(
        { error: "Employee profile not found" },
        { status: 404 },
      );
    }

    const [leaveType] = await db
      .select()
      .from(leaveTypes)
      .where(
        and(
          eq(leaveTypes.id, leaveTypeId),
          eq(leaveTypes.tenantId, auth.tenant.id),
          eq(leaveTypes.isActive, "true"),
        ),
      )
      .limit(1);

    if (!leaveType) {
      return Response.json(
        { error: "Active leave type not found" },
        { status: 404 },
      );
    }

    const notice = daysFromToday(startDate);

    if (notice < 0) {
      return Response.json(
        { error: "Leave start date cannot be in the past" },
        { status: 400 },
      );
    }

    if (
      leaveType.minNoticeDays != null &&
      notice < leaveType.minNoticeDays
    ) {
      return Response.json(
        {
          error: `${leaveType.name} requires at least ${leaveType.minNoticeDays} day(s) notice`,
        },
        { status: 400 },
      );
    }

    if (
      leaveType.maxConsecutiveDays != null &&
      totalDays > leaveType.maxConsecutiveDays
    ) {
      return Response.json(
        {
          error: `${leaveType.name} cannot be taken for more than ${leaveType.maxConsecutiveDays} consecutive day(s)`,
        },
        { status: 400 },
      );
    }

    const year = new Date(startDate).getUTCFullYear();

    const findBalance = async () =>
      (
        await db
          .select()
          .from(leaveBalances)
          .where(
            and(
              eq(leaveBalances.tenantId, auth.tenant.id),
              eq(leaveBalances.employeeId, employee.id),
              eq(leaveBalances.leaveTypeId, leaveTypeId),
              eq(leaveBalances.year, year),
            ),
          )
          .limit(1)
      )[0];

    let balance = await findBalance();

    if (!balance) {
      // New joiners and new years get their allowance automatically.
      await ensureLeaveBalances(auth.tenant.id, employee.id, year);
      balance = await findBalance();
    }

    if (!balance) {
      return Response.json(
        { error: "Leave balance not found for this year" },
        { status: 400 },
      );
    }

    if (balance.remainingDays < totalDays) {
      return Response.json(
        { error: "Insufficient leave balance" },
        { status: 400 },
      );
    }

    const [overlapping] = await db
      .select({ id: leaveRequests.id })
      .from(leaveRequests)
      .where(
        and(
          eq(leaveRequests.tenantId, auth.tenant.id),
          eq(leaveRequests.employeeId, employee.id),
          lte(leaveRequests.startDate, endDate),
          gte(leaveRequests.endDate, startDate),
          inArray(leaveRequests.status, ["approved", "pending"]),
        ),
      )
      .limit(1);

    if (overlapping) {
      return Response.json(
        { error: "These dates overlap with another approved or pending leave request" },
        { status: 409 },
      );
    }

    const [created] = await db
      .insert(leaveRequests)
      .values({
        tenantId: auth.tenant.id,
        employeeId: employee.id,
        leaveTypeId,
        startDate,
        endDate,
        totalDays,
        reason,
        status: "pending",
        managerId: employee.managerId ?? null,
      })
      .returning();

    if (employee.managerId) {
      const [manager] = await db
        .select({ userId: employees.userId })
        .from(employees)
        .where(
          and(
            eq(employees.id, employee.managerId),
            eq(employees.tenantId, auth.tenant.id),
          ),
        )
        .limit(1);

      if (manager?.userId) {
        await createNotification({
          tenantId: auth.tenant.id,
          userId: manager.userId,
          type: "leave_submitted",
          title: "New Leave Request",
          message: `${employee.firstName} ${employee.lastName} submitted a ${leaveType.name} request from ${startDate} to ${endDate}.`,
        });
      }
    }

    await logAudit({
      tenantId: auth.tenant.id,
      userId: auth.user.id,
      action: "leave_submitted",
      entity: "leave_request",
      entityId: created.id,
    });

    return Response.json(created, { status: 201 });
  } catch (error) {
    console.error("Leave request POST error:", error);

    return Response.json(
      { error: "Failed to create leave request" },
      { status: 500 },
    );
  }
}
