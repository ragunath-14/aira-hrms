import { NextResponse } from "next/server";
import { db } from "@/db";
import { designations } from "@/db/schema";
import { zodMessage } from "@/lib/format/error-text";
import { nameTaken } from "@/lib/domain/name-checks";
import { logAudit } from "@/lib/domain/audit";
import { requireRole } from "@/lib/auth/authorization";
import { eq } from "drizzle-orm";
import { designationSchema } from "@/lib/validation/schemas";

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
      .from(designations)
      .where(eq(designations.tenantId, auth.tenant.id));

    return NextResponse.json(result);
  } catch (error) {
    console.error("Designations GET error:", error);

    return NextResponse.json(
      { error: "Failed to fetch designations" },
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

    const parsed = designationSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: zodMessage(parsed.error) },
        { status: 400 },
      );
    }

    if (
      await nameTaken({
        table: designations,
        nameColumn: designations.name,
        tenantColumn: designations.tenantId,
        idColumn: designations.id,
        tenantId: auth.tenant.id,
        name: parsed.data.name,
      })
    ) {
      return NextResponse.json(
        { error: "A designation with this name already exists" },
        { status: 409 },
      );
    }

    const result = await db
      .insert(designations)
      .values({
        tenantId: auth.tenant.id,
        name: parsed.data.name,
        description: parsed.data.description || null,
      })
      .returning();

    await logAudit({
      tenantId: auth.tenant.id,
      userId: auth.user.id,
      action: "designation_created",
      entity: "designation",
      entityId: result[0].id,
    });

    return NextResponse.json(result[0], { status: 201 });
  } catch (error) {
    console.error("Designations POST error:", error);

    return NextResponse.json(
      { error: "Failed to create designation" },
      { status: 500 },
    );
  }
}
