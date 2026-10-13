import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { leaveBalances, leaveTypes } from "@/db/schema/leaves";

// Makes sure an employee has a balance row for every active leave type for the
// given year, creating any that are missing from the leave type's yearly
// allowance. Existing rows are never changed. Safe to call repeatedly.
export async function ensureLeaveBalances(
  tenantId: string,
  employeeId: string,
  year: number = new Date().getFullYear(),
) {
  const [types, existing] = await Promise.all([
    db
      .select({ id: leaveTypes.id, daysPerYear: leaveTypes.daysPerYear })
      .from(leaveTypes)
      .where(and(eq(leaveTypes.tenantId, tenantId), eq(leaveTypes.isActive, "true"))),
    db
      .select({ leaveTypeId: leaveBalances.leaveTypeId })
      .from(leaveBalances)
      .where(
        and(
          eq(leaveBalances.tenantId, tenantId),
          eq(leaveBalances.employeeId, employeeId),
          eq(leaveBalances.year, year),
        ),
      ),
  ]);

  const have = new Set(existing.map((row) => row.leaveTypeId));
  const missing = types.filter((type) => !have.has(type.id));

  if (missing.length === 0) return 0;

  await db.insert(leaveBalances).values(
    missing.map((type) => ({
      tenantId,
      employeeId,
      leaveTypeId: type.id,
      year,
      allocatedDays: type.daysPerYear,
      usedDays: 0,
      remainingDays: type.daysPerYear,
    })),
  );

  return missing.length;
}
