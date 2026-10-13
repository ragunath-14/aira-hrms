import { NextResponse } from "next/server";
import { and, asc, eq } from "drizzle-orm";

import { db } from "@/db";
import { holidays } from "@/db/schema";
import { zodMessage } from "@/lib/format/error-text";
import { requireRole } from "@/lib/auth/authorization";
import { logAudit } from "@/lib/domain/audit";
import { holidaySchema } from "@/lib/validation/schemas";

const ALL_ROLES = ["owner", "admin", "hr", "manager", "employee", "member"] as const;

export async function GET(request: Request) {
  try {
    const auth = await requireRole(request, [...ALL_ROLES]);

    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const year = new URL(request.url).searchParams.get("year");

    const rows = await db
      .select()
      .from(holidays)
      .where(eq(holidays.tenantId, auth.tenant.id))
      .orderBy(asc(holidays.date));

    return NextResponse.json(
      year && /^\d{4}$/.test(year)
        ? rows.filter((h) => h.date.startsWith(year))
        : rows,
    );
  } catch (error) {
    console.error("Holidays GET error:", error);
    return NextResponse.json({ error: "Failed to fetch holidays" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireRole(request, ["owner", "admin", "hr"]);

    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const parsed = holidaySchema.safeParse(await request.json());

    if (!parsed.success) {
      return NextResponse.json({ error: zodMessage(parsed.error) }, { status: 400 });
    }

    const [existing] = await db
      .select({ id: holidays.id })
      .from(holidays)
      .where(
        and(
          eq(holidays.tenantId, auth.tenant.id),
          eq(holidays.date, parsed.data.date),
          eq(holidays.name, parsed.data.name),
        ),
      )
      .limit(1);

    if (existing) {
      return NextResponse.json(
        { error: "This holiday already exists on that date" },
        { status: 409 },
      );
    }

    const [created] = await db
      .insert(holidays)
      .values({
        tenantId: auth.tenant.id,
        name: parsed.data.name,
        date: parsed.data.date,
        type: parsed.data.type,
        description: parsed.data.description || null,
      })
      .returning();

    await logAudit({
      tenantId: auth.tenant.id,
      userId: auth.user.id,
      action: "holiday_created",
      entity: "holiday",
      entityId: created.id,
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error("Holidays POST error:", error);
    return NextResponse.json({ error: "Failed to create holiday" }, { status: 500 });
  }
}
