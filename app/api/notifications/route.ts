import { and, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { notifications } from "@/db/schema/notifications";
import { requirePermission } from "@/lib/authorization";
import { requireRole } from "@/lib/authorization";
export async function GET(request: Request) {
  const authResult = await requirePermission(
    request,
    "users:read",
  );

  if (!authResult.authorized) {
    return Response.json(
      { error: authResult.error },
      { status: authResult.status },
    );
  }
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
  const rows = await db
    .select()
    .from(notifications)
    .where(
      and(
        eq(
          notifications.tenantId,
          authResult.tenant.id,
        ),
        eq(
          notifications.userId,
          authResult.user.id,
        ),
      ),
    )
    .orderBy(desc(notifications.createdAt));

  return Response.json(rows);
}
export async function PATCH(request: Request) {
  try {
    const authResult = await requirePermission(
      request,
      "users:read",
    );

    if (!authResult.authorized) {
      return Response.json(
        { error: authResult.error },
        { status: authResult.status },
      );
    }
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

    const body = await request.json();

    const notificationId =
      body.notificationId;

    if (!notificationId) {
      return Response.json(
        {
          error:
            "notificationId is required",
        },
        { status: 400 },
      );
    }

    const [updated] = await db
      .update(notifications)
      .set({
        isRead: true,
      })
      .where(
        and(
          eq(
            notifications.id,
            notificationId,
          ),
          eq(
            notifications.tenantId,
            authResult.tenant.id,
          ),
          eq(
            notifications.userId,
            authResult.user.id,
          ),
        ),
      )
      .returning();

    if (!updated) {
      return Response.json(
        {
          error:
            "Notification not found",
        },
        { status: 404 },
      );
    }

    return Response.json(updated);
  } catch (error) {
    console.error(
      "Notification PATCH error:",
      error,
    );

    return Response.json(
      {
        error:
          "Failed to update notification",
      },
      { status: 500 },
    );
  }
}