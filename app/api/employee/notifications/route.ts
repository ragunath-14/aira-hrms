import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { notifications } from "@/db/schema";
import { getCurrentTenant } from "@/lib/authorization";

export async function GET(request: Request) {
  try {
    const context = await getCurrentTenant(request);

    if (!context) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 },
      );
    }

    const { user, tenant } = context;

    const employeeNotifications = await db
      .select()
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, user.id),
          eq(notifications.tenantId, tenant.id),
        ),
      )
      .orderBy(desc(notifications.createdAt));

    return NextResponse.json(employeeNotifications);
  } catch (error) {
    console.error(
      "GET employee notifications error:",
      error,
    );

    return NextResponse.json(
      { error: "Failed to fetch employee notifications" },
      { status: 500 },
    );
  }
}
