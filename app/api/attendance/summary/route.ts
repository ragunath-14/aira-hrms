import { and, eq, gte, lte } from "drizzle-orm";

import { db } from "@/db";
import { attendance } from "@/db/schema/attendance";
import { requirePermission } from "@/lib/authorization";
import { type Permission } from "@/lib/permissions";

const ATTENDANCE_READ_PERMISSION =
  "attendance:read" as Permission;

export async function GET(request: Request) {
  try {
    const authResult = await requirePermission(
      request,
      ATTENDANCE_READ_PERMISSION,
    );

    if (!authResult.authorized) {
      return Response.json(
        { error: authResult.error },
        { status: authResult.status },
      );
    }

    const { tenant } = authResult;

    const { searchParams } = new URL(request.url);

    const month = searchParams.get("month");

    if (!month || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
      return Response.json(
        {
          error: "month is required in YYYY-MM format",
        },
        { status: 400 },
      );
    }

    const [year, monthNumber] = month.split("-").map(Number);

    const lastDay = new Date(
      year,
      monthNumber,
      0,
    ).getDate();

    const monthStart = `${month}-01`;
    const monthEnd = `${month}-${String(lastDay).padStart(2, "0")}`;

    const rows = await db
  .select({
    status: attendance.status,
  })
  .from(attendance)
  .where(
    and(
      eq(attendance.tenantId, tenant.id),
      gte(attendance.attendanceDate, monthStart),
      lte(attendance.attendanceDate, monthEnd),
    ),
  );

    const monthlyRows = rows.filter((row) => {
      return row.status !== undefined;
    });

    const summary = {
      month,
      total: monthlyRows.length,
      present: 0,
      absent: 0,
      late: 0,
      halfDay: 0,
      leave: 0,
      holiday: 0,
    };

    for (const row of monthlyRows) {
      switch (row.status) {
        case "present":
          summary.present++;
          break;

        case "absent":
          summary.absent++;
          break;

        case "late":
          summary.late++;
          break;

        case "half_day":
          summary.halfDay++;
          break;

        case "leave":
          summary.leave++;
          break;

        case "holiday":
          summary.holiday++;
          break;
      }
    }

    return Response.json(summary);
  } catch (error) {
    console.error("Attendance summary error:", error);

    return Response.json(
      { error: "Failed to fetch attendance summary" },
      { status: 500 },
    );
  }
}