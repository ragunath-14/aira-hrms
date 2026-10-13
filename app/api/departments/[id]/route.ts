import { isUuid } from "@/lib/validation/ids";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { departments } from "@/db/schema";
import { zodMessage } from "@/lib/format/error-text";
import { nameTaken } from "@/lib/domain/name-checks";
import { logAudit } from "@/lib/domain/audit";
import { requireRole } from "@/lib/auth/authorization";
import { and, eq } from "drizzle-orm";
import { departmentSchema } from "@/lib/validation/schemas";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(
  request: Request,
  { params }: RouteContext,
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

    const { id } = await params;
    if (!isUuid(id)) {
      return Response.json({ error: "Invalid id" }, { status: 400 });
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
        excludeId: id,
      })
    ) {
      return NextResponse.json(
        { error: "A department with this name already exists" },
        { status: 409 },
      );
    }

    const result = await db
      .update(departments)
      .set({
        name: parsed.data.name,
        description: parsed.data.description || null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(departments.id, id),
          eq(departments.tenantId, auth.tenant.id),
        ),
      )
      .returning();

    if (!result.length) {
      return NextResponse.json(
        { error: "Department not found" },
        { status: 404 },
      );
    }

    await logAudit({
      tenantId: auth.tenant.id,
      userId: auth.user.id,
      action: "department_updated",
      entity: "department",
      entityId: id,
    });

    return NextResponse.json(result[0]);
  } catch (error) {
    console.error("Department PATCH error:", error);

    return NextResponse.json(
      { error: "Failed to update department" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: RouteContext,
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

    const { id } = await params;
    if (!isUuid(id)) {
      return Response.json({ error: "Invalid id" }, { status: 400 });
    }

    const result = await db
      .delete(departments)
      .where(
        and(
          eq(departments.id, id),
          eq(departments.tenantId, auth.tenant.id),
        ),
      )
      .returning();

    if (!result.length) {
      return NextResponse.json(
        { error: "Department not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      message: "Department deleted successfully",
    });
  } catch (error) {
    console.error("Department DELETE error:", error);

    return NextResponse.json(
      { error: "Failed to delete department" },
      { status: 500 },
    );
  }
}
