import { and, eq, gte, lte } from "drizzle-orm";

import { db } from "@/db";
import { holidays } from "@/db/schema/engagement";
import type { TenantSettings } from "@/lib/config/settings";

// Number of leave days between two dates (inclusive). By default Saturdays,
// Sundays and the company's holidays are skipped; the company can switch that
// off in Settings -> System. Returns null for an invalid range.
export async function countLeaveDays(
  tenantId: string,
  startDate: string,
  endDate: string,
  settings: TenantSettings,
) {
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
    return null;
  }

  const dayMs = 24 * 60 * 60 * 1000;
  const calendarDays = Math.floor((end.getTime() - start.getTime()) / dayMs) + 1;

  if (settings.leaveCountNonWorkingDays) return calendarDays;

  const holidayRows = await db
    .select({ date: holidays.date })
    .from(holidays)
    .where(
      and(
        eq(holidays.tenantId, tenantId),
        gte(holidays.date, startDate),
        lte(holidays.date, endDate),
      ),
    );

  const holidayDates = new Set(holidayRows.map((row) => row.date));

  let count = 0;

  for (let i = 0; i < calendarDays; i++) {
    const day = new Date(start.getTime() + i * dayMs);
    const weekday = day.getUTCDay();

    if (weekday === 0 || weekday === 6) continue;
    if (holidayDates.has(day.toISOString().slice(0, 10))) continue;

    count++;
  }

  return count;
}
