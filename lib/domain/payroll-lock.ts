import { and, eq, gte, lte } from "drizzle-orm";

import { db } from "@/db";
import { payrollRecords } from "@/db/schema";
import { resolvePayrollRules } from "@/lib/config/payroll-rules";

// Once a month's payroll has been run for someone, anything that would have
// changed what they were paid for that month (their attendance, their leave) is
// locked, so the payslip and the records behind it can never drift apart.
//
// This only applies when the company pays by attendance or pays overtime;
// otherwise attendance and leave do not affect pay and stay editable.
//
// Returns a message to show when the change is blocked, or null when allowed.
export async function payrollLockMessage(params: {
  tenantId: string;
  settings: unknown;
  employeeId: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  // Leave only changes pay when pay follows attendance; punches also drive overtime.
  affects: "attendance" | "leave";
}) {
  const rules = resolvePayrollRules(params.settings);
  const matters =
    params.affects === "leave" ? rules.linkAttendance : rules.linkAttendance || rules.overtime.enabled;

  if (!matters) return null;

  const [locked] = await db
    .select({ period: payrollRecords.payrollPeriod })
    .from(payrollRecords)
    .where(
      and(
        eq(payrollRecords.tenantId, params.tenantId),
        eq(payrollRecords.employeeId, params.employeeId),
        gte(payrollRecords.payrollPeriod, params.startDate.slice(0, 7)),
        lte(payrollRecords.payrollPeriod, params.endDate.slice(0, 7)),
      ),
    )
    .limit(1);

  if (!locked) return null;

  return `Payroll for ${locked.period} is already processed for this person, so their ${
    params.affects === "leave" ? "leave" : "attendance"
  } in that month is locked. Delete that payroll record first if it genuinely needs correcting.`;
}
