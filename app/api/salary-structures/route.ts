import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/authorization";
import { db } from "@/db";
import { employees } from "@/db/schema/employees";
import { salaryStructures } from "@/db/schema";
import { salaryStructureCreateSchema } from "@/lib/validations";

export async function GET(request: Request) {
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

    const structures = await db
      .select({
        id: salaryStructures.id,
        tenantId: salaryStructures.tenantId,
        employeeId: salaryStructures.employeeId,
        basicSalary: salaryStructures.basicSalary,
        effectiveFrom: salaryStructures.effectiveFrom,
        effectiveTo: salaryStructures.effectiveTo,
        status: salaryStructures.status,
      })
      .from(salaryStructures)
      .where(eq(salaryStructures.tenantId, auth.tenant.id));

    return NextResponse.json(structures);
  } catch (error) {
    console.error("GET salary structures error:", error);

    return NextResponse.json(
      { error: "Failed to fetch salary structures" },
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

    const parsed = salaryStructureCreateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { employeeId, basicSalary, effectiveFrom, effectiveTo, status } =
      parsed.data;

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
      return NextResponse.json(
        { error: "Employee not found" },
        { status: 404 },
      );
    }

    const [structure] = await db
      .insert(salaryStructures)
      .values({
        tenantId: auth.tenant.id,
        employeeId,
        basicSalary: String(basicSalary),
        effectiveFrom,
        effectiveTo: effectiveTo || null,
        status: status || "active",
      })
      .returning();

    return NextResponse.json(structure, { status: 201 });
  } catch (error) {
    console.error("POST salary structure error:", error);

    return NextResponse.json(
      { error: "Failed to create salary structure" },
      { status: 500 },
    );
  }
}
