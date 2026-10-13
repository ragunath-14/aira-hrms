import { and, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { notifications } from "@/db/schema/notifications";
import { requireRole } from "@/lib/auth/authorization";
import { isUuid } from "@/lib/validation/ids";

// Notifications are personal: every row is scoped to the caller's own user
// and tenant, so every role may read and acknowledge its own.
const ALL_ROLES = [
  "owner",
  "admin",
  "hr",
  "manager",
  "employee",
  "member",
] as const;

export async function GET(request: Request) {
  try {
    const auth = await requireRole(request, [...ALL_ROLES]);

    if (!auth.authorized) {
      return NextResponse.json(
        { error: auth.error },
        { status: auth.status },
      );
    }

    const rows = await db
      .select()
      .from(notifications)
      .where(
        and(
          eq(notifications.tenantId, auth.tenant.id),
          eq(notifications.userId, auth.user.id),
        ),
      )
      .orderBy(desc(notifications.createdAt));

    return NextResponse.json(rows);
  } catch (error) {
    console.error("Notifications GET error:", error);

    return NextResponse.json(
      { error: "Failed to fetch notifications" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await requireRole(request, [...ALL_ROLES]);

    if (!auth.authorized) {
      return NextResponse.json(
        { error: auth.error },
        { status: auth.status },
      );
    }

    const body = await request.json().catch(() => null);
    const notificationId = body?.notificationId;

    if (!notificationId) {
      return NextResponse.json(
        { error: "notificationId is required" },
        { status: 400 },
      );
    }

    if (!isUuid(notificationId)) {
      return NextResponse.json(
        { error: "Invalid notificationId" },
        { status: 400 },
      );
    }

    const [updated] = await db
      .update(notifications)
      .set({ isRead: true })
      .where(
        and(
          eq(notifications.id, notificationId),
          eq(notifications.tenantId, auth.tenant.id),
          eq(notifications.userId, auth.user.id),
        ),
      )
      .returning();

    if (!updated) {
      return NextResponse.json(
        { error: "Notification not found" },
        { status: 404 },
      );
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Notification PATCH error:", error);

    return NextResponse.json(
      { error: "Failed to update notification" },
      { status: 500 },
    );
  }
}


// Clear every notification of the signed-in user.
export async function DELETE(request: Request) {
  try {
    const auth = await requireRole(request, [...ALL_ROLES]);

    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const removed = await db
      .delete(notifications)
      .where(
        and(
          eq(notifications.tenantId, auth.tenant.id),
          eq(notifications.userId, auth.user.id),
        ),
      )
      .returning({ id: notifications.id });

    return NextResponse.json({ deleted: removed.length });
  } catch (error) {
    console.error("Notifications DELETE error:", error);
    return NextResponse.json({ error: "Failed to clear notifications" }, { status: 500 });
  }
}
