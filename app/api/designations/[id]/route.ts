import { NextResponse } from "next/server";
import { db } from "@/db";
import { designations } from "@/db/schema";
import { requireRole } from "@/lib/authorization";
import { and, eq } from "drizzle-orm";
import { designationSchema } from "@/lib/validations";

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
    const body = await request.json();

    const parsed = designationSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const result = await db
      .update(designations)
      .set({
        name: parsed.data.name,
        description: parsed.data.description || null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(designations.id, id),
          eq(designations.tenantId, auth.tenant.id),
        ),
      )
      .returning();

    if (!result.length) {
      return NextResponse.json(
        { error: "Designation not found" },
        { status: 404 },
      );
    }

    return NextResponse.json(result[0]);
  } catch (error) {
    console.error("Designation PATCH error:", error);

    return NextResponse.json(
      { error: "Failed to update designation" },
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

    const result = await db
      .delete(designations)
      .where(
        and(
          eq(designations.id, id),
          eq(designations.tenantId, auth.tenant.id),
        ),
      )
      .returning();

    if (!result.length) {
      return NextResponse.json(
        { error: "Designation not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      message: "Designation deleted successfully",
    });
  } catch (error) {
    console.error("Designation DELETE error:", error);

    return NextResponse.json(
      { error: "Failed to delete designation" },
      { status: 500 },
    );
  }
}
