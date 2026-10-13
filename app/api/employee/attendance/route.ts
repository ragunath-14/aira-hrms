import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { attendance, employees } from "@/db/schema";
import { getOrCreateCurrentEmployee } from "@/lib/auth/authorization";

export async function GET(request: Request) {
  try {
    const auth = await getOrCreateCurrentEmployee(request);

    if (!auth) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 },
      );
    }

    const { employee, tenant } = auth;

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
