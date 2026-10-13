import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { notifications } from "@/db/schema/notifications";
import { requireRole } from "@/lib/auth/authorization";
import { isUuid } from "@/lib/validation/ids";

const ALL_ROLES = ["owner", "admin", "hr", "manager", "employee", "member"] as const;

// Delete one of your own notifications.
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireRole(request, [...ALL_ROLES]);

    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { id } = await params;

    if (!isUuid(id)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const [deleted] = await db
      .delete(notifications)
      .where(
        and(
          eq(notifications.id, id),
          eq(notifications.tenantId, auth.tenant.id),
          eq(notifications.userId, auth.user.id),
        ),
      )
      .returning({ id: notifications.id });

    if (!deleted) {
      return NextResponse.json({ error: "Notification not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Notification DELETE error:", error);
    return NextResponse.json({ error: "Failed to delete notification" }, { status: 500 });
  }
}
