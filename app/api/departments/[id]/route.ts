import { isUuid } from "@/lib/ids";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { departments } from "@/db/schema";
import { requireRole } from "@/lib/authorization";
import { and, eq } from "drizzle-orm";
import { departmentSchema } from "@/lib/validations";

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
        { error: parsed.error.flatten() },
        { status: 400 },
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
