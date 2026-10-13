import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { announcements, memberships, notifications } from "@/db/schema";
import { requireRole } from "@/lib/auth/authorization";
import { logAudit } from "@/lib/domain/audit";
import { announcementSchema } from "@/lib/validation/schemas";

const ALL_ROLES = ["owner", "admin", "hr", "manager", "employee", "member"] as const;

export async function GET(request: Request) {
  try {
    const auth = await requireRole(request, [...ALL_ROLES]);

    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const rows = await db
      .select()
      .from(announcements)
      .where(eq(announcements.tenantId, auth.tenant.id))
      .orderBy(desc(announcements.pinned), desc(announcements.createdAt))
      .limit(100);

    return NextResponse.json(rows);
  } catch (error) {
    console.error("Announcements GET error:", error);
    return NextResponse.json({ error: "Failed to fetch announcements" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireRole(request, ["owner", "admin", "hr"]);

    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const parsed = announcementSchema.safeParse(await request.json());

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const [created] = await db
      .insert(announcements)
      .values({
        tenantId: auth.tenant.id,
        title: parsed.data.title,
        body: parsed.data.body,
        pinned: parsed.data.pinned ?? false,
        createdBy: auth.user.id,
      })
      .returning();

    // Tell everyone in the company (one bulk insert, not a query per person).
    const members = await db
      .select({ userId: memberships.userId })
      .from(memberships)
      .where(eq(memberships.tenantId, auth.tenant.id));

    const recipients = members.filter((m) => m.userId !== auth.user.id);

    if (recipients.length > 0) {
      await db.insert(notifications).values(
        recipients.map((m) => ({
          tenantId: auth.tenant.id,
          userId: m.userId,
          type: "announcement",
          title: "New announcement",
          message: created.title,
          isRead: false,
        })),
      );
    }

    await logAudit({
      tenantId: auth.tenant.id,
      userId: auth.user.id,
      action: "announcement_created",
      entity: "announcement",
      entityId: created.id,
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error("Announcements POST error:", error);
    return NextResponse.json({ error: "Failed to create announcement" }, { status: 500 });
  }
}
