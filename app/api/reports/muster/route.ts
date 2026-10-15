import { and, asc, eq, gte, lte, ne } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/db";
import { attendance, employees, holidays, leaveRequests, leaveTypes } from "@/db/schema";
import { requireRole } from "@/lib/auth/authorization";
import { resolvePayrollRules } from "@/lib/config/payroll-rules";
import { dateInZone, resolveSettings } from "@/lib/config/settings";
import { buildMusterRow, type MusterLeave } from "@/lib/domain/muster";
import { PAYROLL_PERIOD_PATTERN } from "@/lib/domain/payroll";
import { daysInMonth, type AttendanceDay } from "@/lib/domain/payroll-days";

// The monthly muster roll: every employee's day-by-day attendance with
// leave, weekly offs and holidays, and totals. Owner, admin and HR only.
export async function GET(request: Request) {
  try {
    const auth = await requireRole(request, ["owner", "admin", "hr"]);

    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const url = new URL(request.url);
    const month = url.searchParams.get("month") ?? "";

    if (!PAYROLL_PERIOD_PATTERN.test(month)) {
      return NextResponse.json({ error: "Choose a month, written as YYYY-MM" }, { status: 400 });
    }

    const locationId = url.searchParams.get("locationId");
    const settings = resolveSettings(auth.tenant.settings);
    const rules = resolvePayrollRules(auth.tenant.settings);
    const start = `${month}-01`;
    const end = `${month}-${String(daysInMonth(month)).padStart(2, "0")}`;

    const [people, attendanceRows, leaveRows, holidayRows] = await Promise.all([
      db
        .select({
          id: employees.id,
          firstName: employees.firstName,
          lastName: employees.lastName,
          code: employees.employeeCode,
          joined: employees.dateOfJoining,
          locationId: employees.locationId,
        })
        .from(employees)
        .where(
          and(
            eq(employees.tenantId, auth.tenant.id),
            ne(employees.status, "terminated"),
            locationId ? eq(employees.locationId, locationId) : undefined,
          ),
        )
        .orderBy(asc(employees.employeeCode)),
      db
        .select({
          employeeId: attendance.employeeId,
          date: attendance.attendanceDate,
          status: attendance.status,
          checkIn: attendance.checkIn,
          checkOut: attendance.checkOut,
        })
        .from(attendance)
        .where(
          and(
            eq(attendance.tenantId, auth.tenant.id),
            gte(attendance.attendanceDate, start),
            lte(attendance.attendanceDate, end),
          ),
        ),
      db
        .select({
          employeeId: leaveRequests.employeeId,
          start: leaveRequests.startDate,
          end: leaveRequests.endDate,
          paid: leaveTypes.isPaid,
        })
        .from(leaveRequests)
        .innerJoin(leaveTypes, eq(leaveTypes.id, leaveRequests.leaveTypeId))
        .where(
          and(
            eq(leaveRequests.tenantId, auth.tenant.id),
            eq(leaveRequests.status, "approved"),
            lte(leaveRequests.startDate, end),
            gte(leaveRequests.endDate, start),
          ),
        ),
      db
        .select({ date: holidays.date, locationId: holidays.locationId })
        .from(holidays)
        .where(and(eq(holidays.tenantId, auth.tenant.id), gte(holidays.date, start), lte(holidays.date, end))),
    ]);

    const today = dateInZone(new Date(), settings.timezone);

    const byEmployee = new Map<string, Map<string, AttendanceDay>>();
    for (const row of attendanceRows) {
      const map = byEmployee.get(row.employeeId) ?? new Map<string, AttendanceDay>();
      map.set(row.date, { status: row.status, checkIn: row.checkIn, checkOut: row.checkOut });
      byEmployee.set(row.employeeId, map);
    }

    const leavesByEmployee = new Map<string, MusterLeave[]>();
    for (const row of leaveRows) {
      const list = leavesByEmployee.get(row.employeeId) ?? [];
      list.push({ start: row.start, end: row.end, paid: row.paid });
      leavesByEmployee.set(row.employeeId, list);
    }

    const rows = people.map((person) => {
      const muster = buildMusterRow({
        period: month,
        joinDate: person.joined ? dateInZone(person.joined, settings.timezone) : null,
        today,
        // Company-wide holidays plus those set for this person's location.
        holidays: new Set(
          holidayRows
            .filter((h) => h.locationId === null || h.locationId === person.locationId)
            .map((h) => h.date),
        ),
        attendance: byEmployee.get(person.id) ?? new Map(),
        leaves: leavesByEmployee.get(person.id) ?? [],
        rules,
      });

      return {
        employeeId: person.id,
        code: person.code,
        name: [person.firstName, person.lastName].filter(Boolean).join(" "),
        ...muster,
      };
    });

    const first = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1, 1));

    return NextResponse.json({
      month,
      days: Array.from({ length: daysInMonth(month) }, (_, i) => ({
        day: i + 1,
        weekday: new Date(first.getTime() + i * 86_400_000).getUTCDay(),
      })),
      rows,
    });
  } catch (error) {
    console.error("GET muster report error:", error);

    return NextResponse.json({ error: "Failed to build the muster report" }, { status: 500 });
  }
}
