import { NextResponse } from "next/server";
import { db } from "@/db";
import { locations } from "@/db/schema";
import { requireRole } from "@/lib/auth/authorization";
import { eq } from "drizzle-orm";
import { locationSchema } from "@/lib/validation/schemas";

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
      .from(locations)
      .where(eq(locations.tenantId, auth.tenant.id));

    return NextResponse.json(result);
  } catch (error) {
    console.error("Locations GET error:", error);

    return NextResponse.json(
      { error: "Failed to fetch locations" },
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

    const parsed = locationSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const result = await db
      .insert(locations)
      .values({
        tenantId: auth.tenant.id,
        name: parsed.data.name,
        address: parsed.data.address || null,
        city: parsed.data.city || null,
        state: parsed.data.state || null,
        country: parsed.data.country || null,
      })
      .returning();

    return NextResponse.json(result[0], { status: 201 });
  } catch (error) {
    console.error("Locations POST error:", error);

    return NextResponse.json(
      { error: "Failed to create location" },
      { status: 500 },
    );
  }
}
