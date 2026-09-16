import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { attendance, employees } from "@/db/schema";
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

    const records = await db
      .select()
      .from(attendance)
      .where(
        and(
          eq(attendance.employeeId, employee.id),
          eq(attendance.tenantId, tenant.id),
        ),
      )
      .orderBy(desc(attendance.attendanceDate));

    return NextResponse.json(records);
  } catch (error) {
    console.error("GET employee attendance error:", error);

    return NextResponse.json(
      { error: "Failed to fetch employee attendance" },
      { status: 500 },
    );
  }
}
