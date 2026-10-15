import { isUuid } from "@/lib/validation/ids";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { locations } from "@/db/schema";
import { requireRole } from "@/lib/auth/authorization";
import { and, eq } from "drizzle-orm";
import { locationSchema } from "@/lib/validation/schemas";

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

    const parsed = locationSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const result = await db
      .update(locations)
      .set({
        name: parsed.data.name,
        address: parsed.data.address || null,
        city: parsed.data.city || null,
        state: parsed.data.state || null,
        country: parsed.data.country || null,
        latitude: parsed.data.latitude == null ? null : parsed.data.latitude.toFixed(6),
        longitude: parsed.data.longitude == null ? null : parsed.data.longitude.toFixed(6),
        geofenceRadiusM: parsed.data.geofenceRadiusM ?? null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(locations.id, id),
          eq(locations.tenantId, auth.tenant.id),
        ),
      )
      .returning();

    if (!result.length) {
      return NextResponse.json(
        { error: "Location not found" },
        { status: 404 },
      );
    }

    return NextResponse.json(result[0]);
  } catch (error) {
    console.error("Location PATCH error:", error);

    return NextResponse.json(
      { error: "Failed to update location" },
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
      .delete(locations)
      .where(
        and(
          eq(locations.id, id),
          eq(locations.tenantId, auth.tenant.id),
        ),
      )
      .returning();

    if (!result.length) {
      return NextResponse.json(
        { error: "Location not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      message: "Location deleted successfully",
    });
  } catch (error) {
    console.error("Location DELETE error:", error);

    return NextResponse.json(
      { error: "Failed to delete location" },
      { status: 500 },
    );
  }
}
