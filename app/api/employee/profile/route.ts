import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { departments, designations, locations } from "@/db/schema/organization";
import { employees } from "@/db/schema/employees";
import { employeePhotos } from "@/db/schema/employee-photos";
import { getOrCreateCurrentEmployee } from "@/lib/auth/authorization";

export async function GET(request: Request) {
  try {
    const result = await getOrCreateCurrentEmployee(request);

    if (!result) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 },
      );
    }

    const { employee, tenant, membership } = result;

    const nameOf = async (
      table: typeof departments | typeof designations | typeof locations,
      id: string | null,
    ) => {
      if (!id) return null;
      const [row] = await db
        .select({ name: table.name })
        .from(table)
        .where(eq(table.id, id))
        .limit(1);
      return row?.name ?? null;
    };

    const managerOf = async (id: string | null) => {
      if (!id) return null;
      const [row] = await db
        .select({ firstName: employees.firstName, lastName: employees.lastName })
        .from(employees)
        .where(eq(employees.id, id))
        .limit(1);
      return row ? [row.firstName, row.lastName].filter(Boolean).join(" ") : null;
    };

    const [[photo], departmentName, designationName, locationName, managerName] =
      await Promise.all([
        db
          .select({ updatedAt: employeePhotos.updatedAt })
          .from(employeePhotos)
          .where(eq(employeePhotos.employeeId, employee.id))
          .limit(1),
        nameOf(departments, employee.departmentId),
        nameOf(designations, employee.designationId),
        nameOf(locations, employee.locationId),
        managerOf(employee.managerId),
      ]);

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
      // Changes whenever the photo does; null when there is none.
      photoVersion: photo ? photo.updatedAt.getTime() : null,
      companyName: tenant.name,
      role: membership.role,
      departmentName,
      designationName,
      locationName,
      managerName,
    });
  } catch (error) {
    console.error("GET employee profile error:", error);

    return NextResponse.json(
      { error: "Failed to fetch employee profile" },
      { status: 500 },
    );
  }
}
