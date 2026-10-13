import { NextResponse } from "next/server";
import { db } from "@/db";
import { departments } from "@/db/schema";
import { zodMessage } from "@/lib/format/error-text";
import { nameTaken } from "@/lib/domain/name-checks";
import { logAudit } from "@/lib/domain/audit";
import { requireRole } from "@/lib/auth/authorization";
import { eq } from "drizzle-orm";
import { departmentSchema } from "@/lib/validation/schemas";

export async function GET(request: Request) {
  try {
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

    const result = await db
      .select()
      .from(departments)
      .where(eq(departments.tenantId, auth.tenant.id));

    return NextResponse.json(result);
  } catch (error) {
    console.error("Departments GET error:", error);

    return NextResponse.json(
      { error: "Failed to fetch departments" },
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

    const parsed = departmentSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: zodMessage(parsed.error) },
        { status: 400 },
      );
    }

    if (
      await nameTaken({
        table: departments,
        nameColumn: departments.name,
        tenantColumn: departments.tenantId,
        idColumn: departments.id,
        tenantId: auth.tenant.id,
        name: parsed.data.name,
      })
    ) {
      return NextResponse.json(
        { error: "A department with this name already exists" },
        { status: 409 },
      );
    }

    const result = await db
      .insert(departments)
      .values({
        tenantId: auth.tenant.id,
        name: parsed.data.name,
        description: parsed.data.description || null,
      })
      .returning();

    await logAudit({
      tenantId: auth.tenant.id,
      userId: auth.user.id,
      action: "department_created",
      entity: "department",
      entityId: result[0].id,
    });

    return NextResponse.json(result[0], { status: 201 });
  } catch (error) {
    console.error("Departments POST error:", error);

    return NextResponse.json(
      { error: "Failed to create department" },
      { status: 500 },
    );
  }
}
