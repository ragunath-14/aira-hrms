import { NextResponse } from "next/server";
import { and, asc, eq, ilike, or, sql } from "drizzle-orm";

import { db } from "@/db";
import { employees } from "@/db/schema/employees";
import { departments, designations } from "@/db/schema/organization";
import { getCurrentTenant } from "@/lib/auth/authorization";

// Coworker search for the workspace header. Only active colleagues in the same
// company, and only work details (name, role, department, work email).
export async function GET(request: Request) {
  try {
    const context = await getCurrentTenant(request);

    if (!context) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";

    if (q.length < 2) {
      return NextResponse.json([]);
    }

    const like = `%${q.replace(/[%_\\]/g, "\\$&")}%`;

    const rows = await db
      .select({
        id: employees.id,
        firstName: employees.firstName,
        lastName: employees.lastName,
        email: employees.email,
        department: departments.name,
        designation: designations.name,
      })
      .from(employees)
      .leftJoin(departments, eq(departments.id, employees.departmentId))
      .leftJoin(designations, eq(designations.id, employees.designationId))
      .where(
        and(
          eq(employees.tenantId, context.tenant.id),
          eq(employees.status, "active"),
          or(
            ilike(sql`${employees.firstName} || ' ' || coalesce(${employees.lastName}, '')`, like),
            ilike(employees.email, like),
            ilike(employees.employeeCode, like),
          ),
        ),
      )
      .orderBy(asc(employees.firstName))
      .limit(8);

    return NextResponse.json(
      rows.map((r) => ({
        id: r.id,
        name: [r.firstName, r.lastName].filter(Boolean).join(" "),
        email: r.email,
        department: r.department,
        designation: r.designation,
      })),
    );
  } catch (error) {
    console.error("GET directory error:", error);

    return NextResponse.json(
      { error: "Failed to search the directory" },
      { status: 500 },
    );
  }
}
