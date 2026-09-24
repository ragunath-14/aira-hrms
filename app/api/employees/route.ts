import { isUuid } from "@/lib/ids";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { employees } from "@/db/schema";
import { requireRole } from "@/lib/authorization";
import { logAudit } from "@/lib/audit";
import { employeeCreateSchema } from "@/lib/validations";
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
        { error: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const data = parsed.data;

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
        departmentId: data.departmentId || null,
        designationId: data.designationId || null,
        locationId: data.locationId || null,
        managerId: data.managerId || null,
        userId: data.userId || null,
        status: data.status || "active",
      })
      .returning();

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
