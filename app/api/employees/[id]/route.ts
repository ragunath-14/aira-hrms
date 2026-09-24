import { isUuid } from "@/lib/ids";
import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { employees } from "@/db/schema/employees";
import { departments } from "@/db/schema/organization";
import { designations } from "@/db/schema/organization";
import { locations } from "@/db/schema/organization";
import { attendance } from "@/db/schema/attendance";
import { leaveRequests, leaveTypes, leaveBalances } from "@/db/schema/leaves";
import { payrollRecords } from "@/db/schema/payroll";
import { requireRole } from "@/lib/authorization";
import { logAudit } from "@/lib/audit";
import { employeeUpdateSchema } from "@/lib/validations";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
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

    const [employee] = await db
      .select()
      .from(employees)
      .where(
        and(
          eq(employees.id, id),
          eq(employees.tenantId, auth.tenant.id),
        ),
      )
      .limit(1);

    if (!employee) {
      return NextResponse.json(
        { error: "Employee not found" },
        { status: 404 },
      );
    }

    // Fetch related data in parallel
    const [dept, desig, loc, attendanceRecords, leaveRequestList, leaveBalanceList, payrollList] = await Promise.all([
      employee.departmentId
        ? db.select().from(departments).where(eq(departments.id, employee.departmentId)).limit(1)
        : Promise.resolve([]),
      employee.designationId
        ? db.select().from(designations).where(eq(designations.id, employee.designationId)).limit(1)
        : Promise.resolve([]),
      employee.locationId
        ? db.select().from(locations).where(eq(locations.id, employee.locationId)).limit(1)
        : Promise.resolve([]),
      db.select().from(attendance).where(
        and(
          eq(attendance.employeeId, employee.id),
          eq(attendance.tenantId, auth.tenant.id),
        ),
      ).orderBy(attendance.attendanceDate),
      db.select({
        id: leaveRequests.id,
        leaveTypeId: leaveRequests.leaveTypeId,
        leaveTypeName: leaveTypes.name,
        startDate: leaveRequests.startDate,
        endDate: leaveRequests.endDate,
        totalDays: leaveRequests.totalDays,
        reason: leaveRequests.reason,
        status: leaveRequests.status,
        managerComment: leaveRequests.managerComment,
        createdAt: leaveRequests.createdAt,
      }).from(leaveRequests)
        .leftJoin(leaveTypes, eq(leaveRequests.leaveTypeId, leaveTypes.id))
        .where(
          and(
            eq(leaveRequests.employeeId, employee.id),
            eq(leaveRequests.tenantId, auth.tenant.id),
          ),
        ),
      db.select({
        id: leaveBalances.id,
        leaveTypeId: leaveBalances.leaveTypeId,
        leaveTypeName: leaveTypes.name,
        year: leaveBalances.year,
        allocatedDays: leaveBalances.allocatedDays,
        usedDays: leaveBalances.usedDays,
        remainingDays: leaveBalances.remainingDays,
      }).from(leaveBalances)
        .leftJoin(leaveTypes, eq(leaveBalances.leaveTypeId, leaveTypes.id))
        .where(
          and(
            eq(leaveBalances.employeeId, employee.id),
            eq(leaveBalances.tenantId, auth.tenant.id),
          ),
        ),
      db.select().from(payrollRecords).where(
        and(
          eq(payrollRecords.employeeId, employee.id),
          eq(payrollRecords.tenantId, auth.tenant.id),
        ),
      ).orderBy(payrollRecords.createdAt),
    ]);

    return NextResponse.json({
      ...employee,
      department: dept[0] ?? null,
      designation: desig[0] ?? null,
      location: loc[0] ?? null,
      attendance: attendanceRecords,
      leaveRequests: leaveRequestList,
      leaveBalances: leaveBalanceList,
      payrollRecords: payrollList,
    });
  } catch (error) {
    console.error("GET employee by id error:", error);

    return NextResponse.json(
      { error: "Failed to fetch employee" },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
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

    const { id } = await context.params;
    if (!isUuid(id)) {
      return Response.json({ error: "Invalid id" }, { status: 400 });
    }

    const [employee] = await db
      .select()
      .from(employees)
      .where(
        and(
          eq(employees.id, id),
          eq(employees.tenantId, auth.tenant.id),
        ),
      )
      .limit(1);

    if (!employee) {
      return NextResponse.json(
        { error: "Employee not found" },
        { status: 404 },
      );
    }

    const body = await request.json();

    const parsed = employeeUpdateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const data = parsed.data;

    const updated = await db
      .update(employees)
      .set({
        employeeCode: data.employeeCode ?? employee.employeeCode,
        firstName: data.firstName ?? employee.firstName,
        lastName: data.lastName ?? employee.lastName,
        email: data.email ?? employee.email,
        phone: data.phone ?? employee.phone,
        dateOfJoining: data.dateOfJoining
          ? new Date(data.dateOfJoining)
          : employee.dateOfJoining,
        departmentId: data.departmentId !== undefined ? data.departmentId : employee.departmentId,
        designationId: data.designationId !== undefined ? data.designationId : employee.designationId,
        locationId: data.locationId !== undefined ? data.locationId : employee.locationId,
        managerId: data.managerId !== undefined ? data.managerId : employee.managerId,
        status: data.status ?? employee.status,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(employees.id, id),
          eq(employees.tenantId, auth.tenant.id),
        ),
      )
      .returning();

    await logAudit({
      tenantId: auth.tenant.id,
      userId: auth.user.id,
      action: "employee_updated",
      entity: "employee",
      entityId: id,
    });

    return NextResponse.json(updated[0]);
  } catch (error) {
    console.error("PATCH employee error:", error);

    return NextResponse.json(
      { error: "Failed to update employee" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
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

    const { id } = await context.params;
    if (!isUuid(id)) {
      return Response.json({ error: "Invalid id" }, { status: 400 });
    }

    const [employee] = await db
      .select()
      .from(employees)
      .where(
        and(
          eq(employees.id, id),
          eq(employees.tenantId, auth.tenant.id),
        ),
      )
      .limit(1);

    if (!employee) {
      return NextResponse.json(
        { error: "Employee not found" },
        { status: 404 },
      );
    }

    await db
      .delete(employees)
      .where(
        and(
          eq(employees.id, id),
          eq(employees.tenantId, auth.tenant.id),
        ),
      );

    await logAudit({
      tenantId: auth.tenant.id,
      userId: auth.user.id,
      action: "employee_deleted",
      entity: "employee",
      entityId: id,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE employee error:", error);

    return NextResponse.json(
      { error: "Failed to delete employee" },
      { status: 500 },
    );
  }
}