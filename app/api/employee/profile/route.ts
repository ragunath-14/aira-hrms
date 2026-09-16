import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { employees } from "@/db/schema";
import { getCurrentTenant } from "@/lib/authorization";

export async function GET(request: Request) {
  try {
    const context = await getCurrentTenant(request);

    if (!context) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 },
      );
    }

    const { user, tenant } = context;

    const [employee] = await db
      .select()
      .from(employees)
      .where(
        and(
          eq(employees.userId, user.id),
          eq(employees.tenantId, tenant.id),
        ),
      )
      .limit(1);

    if (!employee) {
      return NextResponse.json(
        { error: "Employee record not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      id: employee.id,
      employeeCode: employee.employeeCode,
      firstName: employee.firstName,
      lastName: employee.lastName,
      email: employee.email,
      phone: employee.phone,
      dateOfJoining: employee.dateOfJoining,
      departmentId: employee.departmentId,
      designationId: employee.designationId,
      locationId: employee.locationId,
      managerId: employee.managerId,
      status: employee.status,
    });
  } catch (error) {
    console.error("GET employee profile error:", error);

    return NextResponse.json(
      { error: "Failed to fetch employee profile" },
      { status: 500 },
    );
  }
}
