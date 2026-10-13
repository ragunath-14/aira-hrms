import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { attendance } from "@/db/schema/attendance";
import { getOrCreateCurrentEmployee } from "@/lib/auth/authorization";
import { dateInZone, resolveSettings } from "@/lib/config/settings";

export async function GET(request: Request) {
  try {
    const context = await getOrCreateCurrentEmployee(request);

    if (!context) {
      return Response.json(
        { error: "Unauthorized" },
        { status: 401 },
      );
    }

    const { tenant, employee } = context;

    // "Today" is the company-timezone date, the same one check-in records.
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

    return Response.json({
      today,
      attendance: record ?? null,
      employeeId: employee.id,
    });
  } catch (error) {
    console.error("GET attendance today error:", error);

    return Response.json(
      { error: "Failed to fetch today's attendance" },
      { status: 500 },
    );
  }
}