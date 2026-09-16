import { NextResponse } from "next/server";
import { db } from "@/db";
import { designations } from "@/db/schema";
import { requireRole } from "@/lib/authorization";
import { eq } from "drizzle-orm";
import { designationSchema } from "@/lib/validations";

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
        { error: parsed.error.flatten() },
        { status: 400 },
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

    return NextResponse.json(result[0], { status: 201 });
  } catch (error) {
    console.error("Designations POST error:", error);

    return NextResponse.json(
      { error: "Failed to create designation" },
      { status: 500 },
    );
  }
}
