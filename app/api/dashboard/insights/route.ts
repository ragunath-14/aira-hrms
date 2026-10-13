import { NextResponse } from "next/server";
import { and, count, desc, eq, gte, lte, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  announcements,
  attendance,
  departments,
  employees,
  holidays,
} from "@/db/schema";
import { requireRole } from "@/lib/auth/authorization";

const ALL_ROLES = ["owner", "admin", "hr", "manager", "employee", "member"] as const;
const HR_ROLES = ["owner", "admin", "hr", "manager"];

function ymd(d: Date) {
  return d.toISOString().slice(0, 10);
}

// Days from `today` until the next MM-DD occurrence of `isoDate` (0 = today).
function daysUntilNext(isoDate: string, today: Date) {
  const [, m, d] = isoDate.split("-").map(Number);
  const start = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  let next = Date.UTC(today.getUTCFullYear(), m - 1, d);

  if (next < start) {
    next = Date.UTC(today.getUTCFullYear() + 1, m - 1, d);
  }

  return Math.round((next - start) / 86_400_000);
}

export async function GET(request: Request) {
  try {
    const auth = await requireRole(request, [...ALL_ROLES]);

    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const tenantId = auth.tenant.id;
    const today = new Date();
    const todayStr = ymd(today);
    const isHr = HR_ROLES.includes(auth.membership.role);

    const weekStart = new Date(today);
    weekStart.setUTCDate(weekStart.getUTCDate() - 6);

    // One round trip: everything below runs in parallel.
    const [people, upcomingHolidays, latestAnnouncements, weekRows, deptRows] =
      await Promise.all([
        db
          .select({
            id: employees.id,
            firstName: employees.firstName,
            lastName: employees.lastName,
            dateOfBirth: employees.dateOfBirth,
            dateOfJoining: employees.dateOfJoining,
          })
          .from(employees)
          .where(and(eq(employees.tenantId, tenantId), eq(employees.status, "active"))),

        db
          .select()
          .from(holidays)
          .where(and(eq(holidays.tenantId, tenantId), gte(holidays.date, todayStr)))
          .orderBy(holidays.date)
          .limit(4),

        db
          .select()
          .from(announcements)
          .where(eq(announcements.tenantId, tenantId))
          .orderBy(desc(announcements.pinned), desc(announcements.createdAt))
          .limit(3),

        isHr
          ? db
              .select({
                date: attendance.attendanceDate,
                status: attendance.status,
                total: count(),
              })
              .from(attendance)
              .where(
                and(
                  eq(attendance.tenantId, tenantId),
                  gte(attendance.attendanceDate, ymd(weekStart)),
                  lte(attendance.attendanceDate, todayStr),
                ),
              )
              .groupBy(attendance.attendanceDate, attendance.status)
          : Promise.resolve([]),

        isHr
          ? db
              .select({
                name: departments.name,
                total: sql<number>`count(${employees.id})::int`,
              })
              .from(departments)
              .leftJoin(
                employees,
                and(
                  eq(employees.departmentId, departments.id),
                  eq(employees.status, "active"),
                ),
              )
              .where(eq(departments.tenantId, tenantId))
              .groupBy(departments.name)
          : Promise.resolve([]),
      ]);

    const name = (p: { firstName: string; lastName: string | null }) =>
      [p.firstName, p.lastName].filter(Boolean).join(" ");

    const birthdays = people
      .filter((p) => p.dateOfBirth)
      .map((p) => ({
        id: p.id,
        name: name(p),
        date: p.dateOfBirth as string,
        inDays: daysUntilNext(p.dateOfBirth as string, today),
      }))
      .filter((p) => p.inDays <= 30)
      .sort((a, b) => a.inDays - b.inDays)
      .slice(0, 6);

    const anniversaries = people
      .filter((p) => p.dateOfJoining)
      .map((p) => {
        const joined = ymd(new Date(p.dateOfJoining as Date));
        const inDays = daysUntilNext(joined, today);
        return { id: p.id, name: name(p), date: joined, inDays };
      })
      .map((a) => ({
        ...a,
        // Years completed on the upcoming anniversary.
        years:
          Number(todayStr.slice(0, 4)) -
          Number(a.date.slice(0, 4)) +
          (a.date.slice(5) < todayStr.slice(5) ? 1 : 0),
      }))
      .filter((a) => a.inDays <= 30 && a.years > 0)
      .sort((a, b) => a.inDays - b.inDays)
      .slice(0, 6);

    // Build a continuous 7-day series so empty days still show.
    const attendanceWeek = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setUTCDate(weekStart.getUTCDate() + i);
      const key = ymd(d);
      const rows = weekRows.filter((r) => String(r.date) === key);
      const sum = (s: string) =>
        rows.filter((r) => r.status === s).reduce((n, r) => n + Number(r.total), 0);
      return {
        date: key,
        present: sum("present"),
        late: sum("late"),
        absent: sum("absent"),
      };
    });

    return NextResponse.json({
      birthdays,
      anniversaries,
      holidays: upcomingHolidays,
      announcements: latestAnnouncements,
      attendanceWeek: isHr ? attendanceWeek : null,
      headcountByDepartment: isHr
        ? deptRows.sort((a, b) => b.total - a.total)
        : null,
    });
  } catch (error) {
    console.error("Dashboard insights GET error:", error);
    return NextResponse.json({ error: "Failed to load insights" }, { status: 500 });
  }
}
