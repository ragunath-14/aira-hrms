import { and, eq, gte, lte } from "drizzle-orm";
import { requireRole } from "@/lib/authorization";
import { NextResponse } from "next/server";
import { db } from "@/db";
import {
  leaveBalances,
  leaveRequests,
  leaveTypes,
} from "@/db/schema/leaves";
import { employees } from "@/db/schema/employees";
import { notifications } from "@/db/schema/notifications";
import { logAudit } from "@/lib/audit";
import { leaveRequestCreateSchema } from "@/lib/validations";

function calculateDays(startDate: string, endDate: string) {
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return null;
  }

  if (end < start) {
    return null;
  }

  const millisecondsPerDay = 1000 * 60 * 60 * 24;

  return (
    Math.floor((end.getTime() - start.getTime()) / millisecondsPerDay) + 1
  );
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
    const status = searchParams.get("status");

    const canViewOthers = ["owner", "admin", "hr", "manager"].includes(
      auth.role,
    );

    let targetEmployeeId: string | null = null;

    if (employeeId && canViewOthers) {
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

    const totalDays = calculateDays(startDate, endDate);

    if (!totalDays) {
      return Response.json(
        { error: "Invalid leave date range" },
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

    const year = new Date(startDate).getUTCFullYear();

    const [balance] = await db
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
      .limit(1);

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
          eq(leaveRequests.status, "approved"),
        ),
      )
      .limit(1);

    if (overlapping) {
      return Response.json(
        { error: "Leave dates overlap with an approved leave" },
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
        await db.insert(notifications).values({
          tenantId: auth.tenant.id,
          userId: manager.userId,
          type: "leave_submitted",
          title: "New Leave Request",
          message: `${employee.firstName} ${employee.lastName} submitted a ${leaveType.name} request from ${startDate} to ${endDate}.`,
          isRead: false,
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
