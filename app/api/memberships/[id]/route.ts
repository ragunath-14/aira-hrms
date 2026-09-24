import { isUuid } from "@/lib/ids";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { memberships } from "@/db/schema/memberships";
import { requireRole } from "@/lib/authorization";
import { logAudit } from "@/lib/audit";
import { createNotification } from "@/lib/notifications";
import { ROLES, type Role } from "@/lib/permissions";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(
  request: Request,
  { params }: RouteContext,
) {
  try {
    const authResult = await requireRole(request, [
      "owner",
      "admin",
    ]);

    if (!authResult.authorized) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status },
      );
    }

    const { id } = await params;
    if (!isUuid(id)) {
      return Response.json({ error: "Invalid id" }, { status: 400 });
    }
    const body = await request.json();
    const role = body.role?.trim() as Role;

    if (!role) {
      return NextResponse.json(
        { error: "role is required" },
        { status: 400 },
      );
    }

    const allowedRoles: Role[] = [
      ROLES.HR,
      ROLES.MANAGER,
      ROLES.EMPLOYEE,
      ROLES.ADMIN,
      ROLES.MEMBER,
    ];

    if (!allowedRoles.includes(role)) {
      return NextResponse.json(
        { error: "Invalid role" },
        { status: 400 },
      );
    }

    // Find the membership to ensure it belongs to this tenant
    const [existing] = await db
      .select()
      .from(memberships)
      .where(
        and(
          eq(memberships.id, id),
          eq(memberships.tenantId, authResult.tenant.id),
        ),
      )
      .limit(1);

    if (!existing) {
      return NextResponse.json(
        { error: "Membership not found" },
        { status: 404 },
      );
    }

    if (existing.role === "owner" && role !== "owner") {
      return NextResponse.json(
        { error: "Cannot change role of the tenant owner" },
        { status: 400 },
      );
    }

    const [updated] = await db
      .update(memberships)
      .set({
        role,
      })
      .where(eq(memberships.id, id))
      .returning();

    await logAudit({
      tenantId: authResult.tenant.id,
      userId: authResult.user.id,
      action: "role_changed",
      entity: "membership",
      entityId: updated.id,
    });

    await createNotification({
      tenantId: authResult.tenant.id,
      userId: updated.userId,
      type: "role_changed",
      title: "Your role was updated",
      message: `Your role was changed from ${existing.role} to ${role}.`,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Membership PATCH error:", error);
    return NextResponse.json(
      { error: "Failed to update membership" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: RouteContext,
) {
  try {
    const authResult = await requireRole(request, [
      "owner",
      "admin",
    ]);

    if (!authResult.authorized) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status },
      );
    }

    const { id } = await params;
    if (!isUuid(id)) {
      return Response.json({ error: "Invalid id" }, { status: 400 });
    }

    // Find the membership to ensure it belongs to this tenant
    const [existing] = await db
      .select()
      .from(memberships)
      .where(
        and(
          eq(memberships.id, id),
          eq(memberships.tenantId, authResult.tenant.id),
        ),
      )
      .limit(1);

    if (!existing) {
      return NextResponse.json(
        { error: "Membership not found" },
        { status: 404 },
      );
    }

    if (existing.role === "owner") {
      return NextResponse.json(
        { error: "Cannot delete the tenant owner's membership" },
        { status: 400 },
      );
    }

    await db
      .delete(memberships)
      .where(eq(memberships.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Membership DELETE error:", error);
    return NextResponse.json(
      { error: "Failed to delete membership" },
      { status: 500 },
    );
  }
}
