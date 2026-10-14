import { isUuid } from "@/lib/validation/ids";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { employees } from "@/db/schema";
import { zodMessage } from "@/lib/format/error-text";
import { findEmployeeDuplicate } from "@/lib/domain/employee-checks";
import { ensureLeaveBalances } from "@/lib/domain/leave-balances";
import { requireRole } from "@/lib/auth/authorization";
import { logAudit } from "@/lib/domain/audit";
import { checkCanAddPeople } from "@/lib/domain/plans";
import { employeeCreateSchema } from "@/lib/validation/schemas";
import {
  and,
  eq,
  ilike,
  or,
} from "drizzle-orm";

export async function GET(request: Request) {
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

    const { searchParams } = new URL(request.url);

    const search = searchParams.get("search");
    const status = searchParams.get("status");
    const departmentId = searchParams.get("departmentId");

    if (departmentId && !isUuid(departmentId)) {
      return Response.json(
        { error: "Invalid departmentId" },
        { status: 400 },
      );
    }
    const designationId = searchParams.get("designationId");
    const locationId = searchParams.get("locationId");

    const conditions = [
      eq(employees.tenantId, auth.tenant.id),
    ];

    if (status) {
      conditions.push(eq(employees.status, status));
    }

    if (departmentId) {
      conditions.push(eq(employees.departmentId, departmentId));
    }

    if (designationId) {
      conditions.push(eq(employees.designationId, designationId));
    }

    if (locationId) {
      conditions.push(eq(employees.locationId, locationId));
    }

    if (search) {
      const searchCondition = or(
        ilike(employees.firstName, `%${search}%`),
        ilike(employees.lastName, `%${search}%`),
        ilike(employees.email, `%${search}%`),
        ilike(employees.employeeCode, `%${search}%`),
      );

      if (searchCondition) {
        conditions.push(searchCondition);
      }
    }

    const result = await db
      .select()
      .from(employees)
      .where(and(...conditions));

    return NextResponse.json(result);
  } catch (error) {
    console.error("Employees GET error:", error);

    return NextResponse.json(
      { error: "Failed to fetch employees" },
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
    ]);

    if (!auth.authorized) {
      return NextResponse.json(
        { error: auth.error },
        { status: auth.status },
      );
    }

    const body = await request.json();

    const parsed = employeeCreateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: zodMessage(parsed.error) },
        { status: 400 },
      );
    }

    const data = parsed.data;

    const duplicate = await findEmployeeDuplicate({
      tenantId: auth.tenant.id,
      employeeCode: data.employeeCode,
      email: data.email,
    });

    if (duplicate) {
      return NextResponse.json({ error: duplicate }, { status: 409 });
    }

    const planProblem = await checkCanAddPeople(auth.tenant);

    if (planProblem) {
      return NextResponse.json({ error: planProblem }, { status: 402 });
    }

    const result = await db
      .insert(employees)
      .values({
        tenantId: auth.tenant.id,
        employeeCode: data.employeeCode,
        firstName: data.firstName,
        lastName: data.lastName || null,
        email: data.email,
        phone: data.phone || null,
        dateOfJoining: data.dateOfJoining
          ? new Date(data.dateOfJoining)
          : null,
        dateOfBirth: data.dateOfBirth || null,
        departmentId: data.departmentId || null,
        designationId: data.designationId || null,
        locationId: data.locationId || null,
        managerId: data.managerId || null,
        userId: data.userId || null,
        status: data.status || "active",
      })
      .returning();

    // New joiners get this year's leave allowance straight away.
    await ensureLeaveBalances(auth.tenant.id, result[0].id);

    await logAudit({
      tenantId: auth.tenant.id,
      userId: auth.user.id,
      action: "employee_created",
      entity: "employee",
      entityId: result[0].id,
    });

    return NextResponse.json(result[0], { status: 201 });
  } catch (error) {
    console.error("Employees POST error:", error);

    return NextResponse.json(
      { error: "Failed to create employee" },
      { status: 500 },
    );
  }
}
