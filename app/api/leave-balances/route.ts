import { isUuid } from "@/lib/validation/ids";
import { and, eq } from "drizzle-orm";
import {
  getCurrentTenant,
  requireRole,
} from "@/lib/auth/authorization";
import { db } from "@/db";
import {
  leaveBalances,
  leaveTypes,
} from "@/db/schema/leaves";
import { NextResponse } from "next/server";
import { employees } from "@/db/schema/employees";
import { requirePermission } from "@/lib/auth/authorization";
import {
  type Permission,
} from "@/lib/auth/permissions";

const LEAVE_READ_PERMISSION =
  "leave:read" as Permission;

const LEAVE_MANAGE_PERMISSION =
  "leave:manage" as Permission;

export async function GET(request: Request) {
  try {
    const authResult = await requirePermission(
      request,
      LEAVE_READ_PERMISSION,
    );

    if (!authResult.authorized) {
      return Response.json(
        { error: authResult.error },
        { status: authResult.status },
      );
    }
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

    const employeeId =
      searchParams.get("employeeId");

    if (employeeId && !isUuid(employeeId)) {
      return Response.json(
        { error: "Invalid employeeId" },
        { status: 400 },
      );
    }

    const yearParam =
      searchParams.get("year");

    const year = yearParam
      ? Number(yearParam)
      : new Date().getFullYear();

    if (!Number.isInteger(year)) {
      return Response.json(
        { error: "Invalid year" },
        { status: 400 },
      );
    }

    const canViewOthers = ["owner", "admin", "hr", "manager"].includes(
      auth.role,
    );

    let targetEmployeeId: string | null = null;

    if (!employeeId && canViewOthers) {
      // HR/manager/owner fetching the whole tenant's balances in one call.
      targetEmployeeId = null;
    } else if (employeeId && canViewOthers) {
      const [employee] = await db
        .select({
          id: employees.id,
        })
        .from(employees)
        .where(
          and(
            eq(employees.id, employeeId),
            eq(
              employees.tenantId,
              authResult.tenant.id,
            ),
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
        .select({
          id: employees.id,
        })
        .from(employees)
        .where(
          and(
            eq(
              employees.userId,
              authResult.user.id,
            ),
            eq(
              employees.tenantId,
              authResult.tenant.id,
            ),
          ),
        )
        .limit(1);

      if (!employee) {
        return Response.json(
          { error: "Employee profile not found" },
          { status: 404 },
        );
      }

      targetEmployeeId = employee.id;
    }

    const balances = await db
      .select({
        id: leaveBalances.id,
        employeeId:
          leaveBalances.employeeId,
        leaveTypeId:
          leaveBalances.leaveTypeId,
        leaveType:
          leaveTypes.name,
        year: leaveBalances.year,
        allocatedDays:
          leaveBalances.allocatedDays,
        usedDays:
          leaveBalances.usedDays,
        remainingDays:
          leaveBalances.remainingDays,
      })
      .from(leaveBalances)
      .innerJoin(
        leaveTypes,
        eq(
          leaveBalances.leaveTypeId,
          leaveTypes.id,
        ),
      )
      .where(
        and(
          eq(
            leaveBalances.tenantId,
            authResult.tenant.id,
          ),
          eq(leaveBalances.year, year),
          ...(targetEmployeeId
            ? [eq(leaveBalances.employeeId, targetEmployeeId)]
            : []),
        ),
      );

    return Response.json(balances);
  } catch (error) {
    console.error("Leave balance GET error:", error);

    return Response.json(
      { error: "Failed to fetch leave balances" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const authResult = await requirePermission(
      request,
      LEAVE_MANAGE_PERMISSION,
    );

    if (!authResult.authorized) {
      return Response.json(
        { error: authResult.error },
        { status: authResult.status },
      );
    }
    const auth = await requireRole(request, [
      "owner",
      "admin",
      "hr",
    ]);

    if (!auth.authorized) {
      return NextResponse.json(
        { error: auth.error },
        { status: auth.status },
      );
    }

    const body = await request.json();

    const employeeId = body.employeeId;
    const leaveTypeId = body.leaveTypeId;

    const year = Number(
      body.year ?? new Date().getFullYear(),
    );

    const allocatedDays = Number(
      body.allocatedDays ?? 0,
    );

    if (!employeeId || !leaveTypeId) {
      return Response.json(
        {
          error:
            "employeeId and leaveTypeId are required",
        },
        { status: 400 },
      );
    }

    if (
      !Number.isInteger(year) ||
      !Number.isInteger(allocatedDays) ||
      allocatedDays < 0
    ) {
      return Response.json(
        { error: "Invalid year or allocatedDays" },
        { status: 400 },
      );
    }

    const [employee] = await db
      .select()
      .from(employees)
      .where(
        and(
          eq(employees.id, employeeId),
          eq(
            employees.tenantId,
            authResult.tenant.id,
          ),
        ),
      )
      .limit(1);

    if (!employee) {
      return Response.json(
        { error: "Employee not found" },
        { status: 404 },
      );
    }

    const [leaveType] = await db
      .select()
      .from(leaveTypes)
      .where(
        and(
          eq(leaveTypes.id, leaveTypeId),
          eq(
            leaveTypes.tenantId,
            authResult.tenant.id,
          ),
        ),
      )
      .limit(1);

    if (!leaveType) {
      return Response.json(
        { error: "Leave type not found" },
        { status: 404 },
      );
    }

    const [existing] = await db
      .select()
      .from(leaveBalances)
      .where(
        and(
          eq(
            leaveBalances.tenantId,
            authResult.tenant.id,
          ),
          eq(
            leaveBalances.employeeId,
            employeeId,
          ),
          eq(
            leaveBalances.leaveTypeId,
            leaveTypeId,
          ),
          eq(leaveBalances.year, year),
        ),
      )
      .limit(1);

    if (existing) {
      return Response.json(
        {
          error:
            "Leave balance already exists for this employee and year",
        },
        { status: 409 },
      );
    }

    const [created] = await db
      .insert(leaveBalances)
      .values({
        tenantId: authResult.tenant.id,
        employeeId,
        leaveTypeId,
        year,
        allocatedDays,
        usedDays: 0,
        remainingDays: allocatedDays,
      })
      .returning();

    return Response.json(created, {
      status: 201,
    });
  } catch (error) {
    console.error("Leave balance POST error:", error);

    return Response.json(
      { error: "Failed to create leave balance" },
      { status: 500 },
    );
  }
}