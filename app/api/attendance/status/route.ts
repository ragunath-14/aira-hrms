import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { attendance } from "@/db/schema/attendance";
import { getOrCreateCurrentEmployee } from "@/lib/auth/authorization";
import { dateInZone, resolveSettings } from "@/lib/config/settings";
import { zodMessage } from "@/lib/format/error-text";
import { presenceStatusSchema } from "@/lib/validation/schemas";

// Changes your own live presence for today: Office/Remote, and a short
// lunch, break or away status with a duration ("working" clears it).
export async function POST(request: Request) {
  try {
    const context = await getOrCreateCurrentEmployee(request);

    if (!context) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsed = presenceStatusSchema.safeParse(await request.json());

    if (!parsed.success) {
      return NextResponse.json({ error: zodMessage(parsed.error) }, { status: 400 });
    }

    const { tenant, employee } = context;
    const today = dateInZone(new Date(), resolveSettings(tenant.settings).timezone);

    const [record] = await db
      .select()
      .from(attendance)
      .where(
        and(
          eq(attendance.tenantId, tenant.id),
          eq(attendance.employeeId, employee.id),
          eq(attendance.attendanceDate, today),
        ),
      )
      .limit(1);

    if (!record?.checkIn) {
      return NextResponse.json({ error: "Check in first" }, { status: 400 });
    }

    if (record.checkOut) {
      return NextResponse.json({ error: "You have already checked out today" }, { status: 409 });
    }

    const { workMode, status, minutes } = parsed.data;
    const update: Partial<typeof attendance.$inferInsert> = { updatedAt: new Date() };

    if (workMode) update.workMode = workMode;

    if (status === "working") {
      update.breakType = null;
      update.breakUntil = null;
    } else if (status) {
      const defaults = { lunch: 60, break: 15, away: 15 } as const;
      update.breakType = status;
      update.breakUntil = new Date(Date.now() + (minutes ?? defaults[status]) * 60_000);
    }

    const [updated] = await db
      .update(attendance)
      .set(update)
      .where(eq(attendance.id, record.id))
      .returning();

    return NextResponse.json(updated);
  } catch (error) {
    console.error("POST attendance status error:", error);

    return NextResponse.json(
      { error: "Failed to update your status" },
      { status: 500 },
    );
  }
}
