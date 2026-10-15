import { and, asc, desc, eq, gte, isNull, lt, lte, or, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  attendance,
  employeeStatutory,
  employees,
  holidays,
  leaveRequests,
  leaveTypes,
  loanRepayments,
  loans,
  payrollAdjustments,
  payrollItems,
  payrollRecords,
  payrollRuns,
  payslips,
  salaryComponents,
  salaryStructures,
  tenants,
} from "@/db/schema";
import { resolvePayrollRules } from "@/lib/config/payroll-rules";
import { resolveSettings, dateInZone } from "@/lib/config/settings";
import { anyStatutoryEnabled, resolveStatutory } from "@/lib/config/statutory";
import { computeDays, overtimePay, type AttendanceDay, type DaysResult } from "@/lib/domain/payroll-days";
import {
  DEFAULT_PROFILE,
  computeStatutory,
  financialYearStart,
  type StatutoryProfile,
} from "@/lib/domain/statutory";

// Payroll periods are calendar months written YYYY-MM (month 01-12).
export const PAYROLL_PERIOD_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

function periodBounds(period: string) {
  const [year, month] = period.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();

  return {
    start: `${period}-01`,
    end: `${period}-${String(lastDay).padStart(2, "0")}`,
  };
}

export async function loadStatutoryProfile(
  tenantId: string,
  employeeId: string,
): Promise<StatutoryProfile> {
  const [row] = await db
    .select()
    .from(employeeStatutory)
    .where(and(eq(employeeStatutory.tenantId, tenantId), eq(employeeStatutory.employeeId, employeeId)))
    .limit(1);

  if (!row) return DEFAULT_PROFILE;

  return {
    pfApplicable: row.pfApplicable,
    esiApplicable: row.esiApplicable,
    ptApplicable: row.ptApplicable,
    taxRegime: row.taxRegime === "old" ? "old" : "new",
    declaredDeductions: Number(row.declaredDeductions),
  };
}

// Pay already processed for this employee earlier in the same financial year
// (April to March), which TDS needs to project the rest of the year.
async function loadYearToDate(tenantId: string, employeeId: string, period: string) {
  const [row] = await db
    .select({
      gross: sql<string>`coalesce(sum(${payrollRecords.basicSalary} + ${payrollRecords.totalAllowances}), 0)`,
      pfEmployee: sql<string>`coalesce(sum(${payrollRecords.pfEmployee}), 0)`,
      professionalTax: sql<string>`coalesce(sum(${payrollRecords.professionalTax}), 0)`,
      tds: sql<string>`coalesce(sum(${payrollRecords.tds}), 0)`,
    })
    .from(payrollRecords)
    .where(
      and(
        eq(payrollRecords.tenantId, tenantId),
        eq(payrollRecords.employeeId, employeeId),
        gte(payrollRecords.payrollPeriod, financialYearStart(period)),
        lt(payrollRecords.payrollPeriod, period),
      ),
    );

  return {
    gross: Number(row?.gross ?? 0),
    pfEmployee: Number(row?.pfEmployee ?? 0),
    professionalTax: Number(row?.professionalTax ?? 0),
    tds: Number(row?.tds ?? 0),
  };
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

// Everything the day engine needs about one employee's month.
async function loadMonthContext(
  tenantId: string,
  employeeId: string,
  period: string,
  settings: ReturnType<typeof resolveSettings>,
) {
  const { start, end } = periodBounds(period);

  const [person] = await db
    .select({ joined: employees.dateOfJoining, locationId: employees.locationId })
    .from(employees)
    .where(and(eq(employees.id, employeeId), eq(employees.tenantId, tenantId)))
    .limit(1);

  const [holidayRows, attendanceRows, leaveRows] = await Promise.all([
    // Company-wide holidays, plus those set for this person's own location.
    db
      .select({ date: holidays.date })
      .from(holidays)
      .where(
        and(
          eq(holidays.tenantId, tenantId),
          gte(holidays.date, start),
          lte(holidays.date, end),
          person?.locationId
            ? or(isNull(holidays.locationId), eq(holidays.locationId, person.locationId))
            : isNull(holidays.locationId),
        ),
      ),
    db
      .select({
        date: attendance.attendanceDate,
        status: attendance.status,
        checkIn: attendance.checkIn,
        checkOut: attendance.checkOut,
      })
      .from(attendance)
      .where(
        and(
          eq(attendance.tenantId, tenantId),
          eq(attendance.employeeId, employeeId),
          gte(attendance.attendanceDate, start),
          lte(attendance.attendanceDate, end),
        ),
      ),
    db
      .select({ start: leaveRequests.startDate, end: leaveRequests.endDate, paid: leaveTypes.isPaid })
      .from(leaveRequests)
      .innerJoin(leaveTypes, eq(leaveTypes.id, leaveRequests.leaveTypeId))
      .where(
        and(
          eq(leaveRequests.tenantId, tenantId),
          eq(leaveRequests.employeeId, employeeId),
          eq(leaveRequests.status, "approved"),
          lte(leaveRequests.startDate, end),
          gte(leaveRequests.endDate, start),
        ),
      ),
  ]);

  return {
    joinDate: person?.joined ? dateInZone(person.joined, settings.timezone) : null,
    today: dateInZone(new Date(), settings.timezone),
    holidays: new Set(holidayRows.map((row) => row.date)),
    attendance: new Map<string, AttendanceDay>(
      attendanceRows.map((row) => [
        row.date,
        { status: row.status, checkIn: row.checkIn, checkOut: row.checkOut },
      ]),
    ),
    leaves: leaveRows,
  };
}

export type PayrollLoanLine = { loanId: string; amount: number };

// Works out one employee's pay for a month: their active salary structure and
// the salary components that apply to them (company-wide ones plus any set for
// this person), cut back for days not worked and topped up with overtime when
// the company has switched those rules on, then one-off adjustments, loan
// instalments, and whichever statutory deductions (PF, ESI, professional tax,
// TDS, LWF) are switched on. Nothing here comes from the browser, so the
// figures cannot be tampered with.
export async function calculatePayroll(
  tenantId: string,
  employeeId: string,
  period: string,
) {
  const { start, end } = periodBounds(period);

  const [structure] = await db
    .select({ basicSalary: salaryStructures.basicSalary })
    .from(salaryStructures)
    .where(
      and(
        eq(salaryStructures.tenantId, tenantId),
        eq(salaryStructures.employeeId, employeeId),
        eq(salaryStructures.status, "active"),
        lte(salaryStructures.effectiveFrom, end),
        or(
          isNull(salaryStructures.effectiveTo),
          gte(salaryStructures.effectiveTo, start),
        ),
      ),
    )
    .orderBy(desc(salaryStructures.effectiveFrom))
    .limit(1);

  if (!structure) return null;

  const [[totals], [tenant], [adjustments]] = await Promise.all([
    db
      .select({
        allowances: sql<string>`coalesce(sum(case when ${salaryComponents.type} = 'allowance' then ${salaryComponents.amount} else 0 end), 0)`,
        deductions: sql<string>`coalesce(sum(case when ${salaryComponents.type} = 'deduction' then ${salaryComponents.amount} else 0 end), 0)`,
      })
      .from(salaryComponents)
      .where(
        and(
          eq(salaryComponents.tenantId, tenantId),
          or(isNull(salaryComponents.employeeId), eq(salaryComponents.employeeId, employeeId)),
        ),
      ),
    db.select({ settings: tenants.settings }).from(tenants).where(eq(tenants.id, tenantId)).limit(1),
    db
      .select({
        earnings: sql<string>`coalesce(sum(case when ${payrollAdjustments.kind} = 'earning' then ${payrollAdjustments.amount} else 0 end), 0)`,
        deductions: sql<string>`coalesce(sum(case when ${payrollAdjustments.kind} = 'deduction' then ${payrollAdjustments.amount} else 0 end), 0)`,
      })
      .from(payrollAdjustments)
      .where(
        and(
          eq(payrollAdjustments.tenantId, tenantId),
          eq(payrollAdjustments.employeeId, employeeId),
          eq(payrollAdjustments.payrollPeriod, period),
        ),
      ),
  ]);

  const settings = resolveSettings(tenant?.settings);
  const rules = resolvePayrollRules(tenant?.settings);

  const basic = Number(structure.basicSalary);
  const allowances = Number(totals?.allowances ?? 0);
  const componentDeductions = Number(totals?.deductions ?? 0);
  const adjustmentEarnings = Number(adjustments?.earnings ?? 0);
  const adjustmentDeductions = Number(adjustments?.deductions ?? 0);

  // Days worked and overtime, only when the company asked for them.
  let days: DaysResult | null = null;

  if (rules.linkAttendance || rules.overtime.enabled) {
    const context = await loadMonthContext(tenantId, employeeId, period, settings);

    days = computeDays({
      period,
      joinDate: context.joinDate,
      today: context.today,
      holidays: context.holidays,
      attendance: context.attendance,
      leaves: context.leaves,
      rules,
    });
  }

  const fraction = rules.linkAttendance && days ? days.fraction : 1;
  const earnedBasic = round2(basic * fraction);
  const earnedAllowances = round2(allowances * fraction);
  const overtime = days
    ? overtimePay({ minutes: days.overtimeMinutes, monthlyBasic: basic, workingDays: days.workingDays, rules })
    : 0;

  // Allowances here means every earning besides basic, so gross = basic +
  // allowances everywhere it is used.
  const otherEarnings = round2(earnedAllowances + overtime + adjustmentEarnings);
  const gross = round2(earnedBasic + otherEarnings);

  const config = resolveStatutory(tenant?.settings);

  const statutory = anyStatutoryEnabled(config)
    ? computeStatutory({
        config,
        period,
        basic: earnedBasic,
        gross,
        profile: await loadStatutoryProfile(tenantId, employeeId),
        history: await loadYearToDate(tenantId, employeeId, period),
      })
    : null;

  const withheld = statutory?.employeeDeductions ?? 0;

  // Loan and advance instalments, never taking more than is left of the pay.
  const activeLoans = await db
    .select()
    .from(loans)
    .where(
      and(
        eq(loans.tenantId, tenantId),
        eq(loans.employeeId, employeeId),
        eq(loans.status, "active"),
        lte(loans.startPeriod, period),
      ),
    )
    .orderBy(asc(loans.createdAt));

  const alreadyTaken = activeLoans.length
    ? await db
        .select({ loanId: loanRepayments.loanId })
        .from(loanRepayments)
        .where(eq(loanRepayments.payrollPeriod, period))
    : [];
  const takenIds = new Set(alreadyTaken.map((row) => row.loanId));

  let room = Math.max(0, gross - componentDeductions - withheld - adjustmentDeductions);
  const loanLines: PayrollLoanLine[] = [];

  for (const loan of activeLoans) {
    if (takenIds.has(loan.id) || room <= 0) continue;

    const amount = round2(Math.min(Number(loan.installmentAmount), Number(loan.balance), room));

    if (amount > 0) {
      loanLines.push({ loanId: loan.id, amount });
      room = round2(room - amount);
    }
  }

  const loanDeduction = round2(loanLines.reduce((total, line) => total + line.amount, 0));
  const totalDeductions = round2(componentDeductions + withheld + adjustmentDeductions + loanDeduction);

  return {
    basicSalary: earnedBasic.toFixed(2),
    totalAllowances: otherEarnings.toFixed(2),
    totalDeductions: totalDeductions.toFixed(2),
    netSalary: (gross - totalDeductions).toFixed(2),
    pfWage: (statutory?.pfWage ?? 0).toFixed(2),
    pfEmployee: (statutory?.pfEmployee ?? 0).toFixed(2),
    pfEmployer: (statutory?.pfEmployer ?? 0).toFixed(2),
    esiWage: (statutory?.esiWage ?? 0).toFixed(2),
    esiEmployee: (statutory?.esiEmployee ?? 0).toFixed(2),
    esiEmployer: (statutory?.esiEmployer ?? 0).toFixed(2),
    professionalTax: (statutory?.professionalTax ?? 0).toFixed(2),
    tds: (statutory?.tds ?? 0).toFixed(2),
    lwfEmployee: (statutory?.lwfEmployee ?? 0).toFixed(2),
    lwfEmployer: (statutory?.lwfEmployer ?? 0).toFixed(2),
    daysInPeriod: rules.linkAttendance && days ? days.divisor : 0,
    paidDays: (rules.linkAttendance && days ? days.paidDays : 0).toFixed(2),
    lopDays: (rules.linkAttendance && days ? days.lopDays : 0).toFixed(2),
    overtimeHours: ((days?.overtimeMinutes ?? 0) / 60).toFixed(2),
    overtimePay: overtime.toFixed(2),
    adjustmentEarnings: adjustmentEarnings.toFixed(2),
    adjustmentDeductions: adjustmentDeductions.toFixed(2),
    loanDeduction: loanDeduction.toFixed(2),
    // Not stored on the record: used to settle loans once it is saved.
    loanLines,
  };
}

export async function createPayrollRecordWithRun(params: {
  tenantId: string;
  employeeId: string;
  payrollPeriod: string;
  basicSalary: string;
  totalAllowances: string;
  totalDeductions: string;
  netSalary: string;
  pfWage?: string;
  pfEmployee?: string;
  pfEmployer?: string;
  esiWage?: string;
  esiEmployee?: string;
  esiEmployer?: string;
  professionalTax?: string;
  tds?: string;
  lwfEmployee?: string;
  lwfEmployer?: string;
  daysInPeriod?: number;
  paidDays?: string;
  lopDays?: string;
  overtimeHours?: string;
  overtimePay?: string;
  adjustmentEarnings?: string;
  adjustmentDeductions?: string;
  loanDeduction?: string;
  status?: string;
}) {
  const [record] = await db
    .insert(payrollRecords)
    .values({
      tenantId: params.tenantId,
      employeeId: params.employeeId,
      payrollPeriod: params.payrollPeriod,
      basicSalary: params.basicSalary,
      totalAllowances: params.totalAllowances,
      totalDeductions: params.totalDeductions,
      netSalary: params.netSalary,
      pfWage: params.pfWage ?? "0",
      pfEmployee: params.pfEmployee ?? "0",
      pfEmployer: params.pfEmployer ?? "0",
      esiWage: params.esiWage ?? "0",
      esiEmployee: params.esiEmployee ?? "0",
      esiEmployer: params.esiEmployer ?? "0",
      professionalTax: params.professionalTax ?? "0",
      tds: params.tds ?? "0",
      lwfEmployee: params.lwfEmployee ?? "0",
      lwfEmployer: params.lwfEmployer ?? "0",
      daysInPeriod: params.daysInPeriod ?? 0,
      paidDays: params.paidDays ?? "0",
      lopDays: params.lopDays ?? "0",
      overtimeHours: params.overtimeHours ?? "0",
      overtimePay: params.overtimePay ?? "0",
      adjustmentEarnings: params.adjustmentEarnings ?? "0",
      adjustmentDeductions: params.adjustmentDeductions ?? "0",
      loanDeduction: params.loanDeduction ?? "0",
      status: params.status || "processed",
    })
    .returning();

  const [existingRun] = await db
    .select()
    .from(payrollRuns)
    .where(
      and(
        eq(payrollRuns.tenantId, params.tenantId),
        eq(payrollRuns.payrollPeriod, params.payrollPeriod),
      ),
    )
    .limit(1);

  const run =
    existingRun ??
    (
      await db
        .insert(payrollRuns)
        .values({
          tenantId: params.tenantId,
          payrollPeriod: params.payrollPeriod,
          status: "processing",
        })
        .returning()
    )[0];

  await db.insert(payrollItems).values({
    payrollRunId: run.id,
    payrollRecordId: record.id,
    employeeId: params.employeeId,
    basicSalary: params.basicSalary,
    totalAllowances: params.totalAllowances,
    totalDeductions: params.totalDeductions,
    netSalary: params.netSalary,
  });

  await db
    .update(payrollRuns)
    .set({
      status: "completed",
      totalNetPay: sql`${payrollRuns.totalNetPay} + ${params.netSalary}`,
      updatedAt: new Date(),
    })
    .where(eq(payrollRuns.id, run.id));

  return record;
}

export type GenerateResult =
  | { outcome: "created"; recordId: string; netSalary: string }
  | { outcome: "exists" }
  | { outcome: "no_structure" };

// Pays one employee for one month: calculates the figures, stores the payroll
// record and generates the payslip. Never pays the same month twice.
export async function generatePayrollForEmployee(
  tenantId: string,
  employeeId: string,
  period: string,
): Promise<GenerateResult> {
  const [existing] = await db
    .select({ id: payrollRecords.id })
    .from(payrollRecords)
    .where(
      and(
        eq(payrollRecords.tenantId, tenantId),
        eq(payrollRecords.employeeId, employeeId),
        eq(payrollRecords.payrollPeriod, period),
      ),
    )
    .limit(1);

  if (existing) return { outcome: "exists" };

  const calculated = await calculatePayroll(tenantId, employeeId, period);

  if (!calculated) return { outcome: "no_structure" };

  const { loanLines, ...figures } = calculated;

  const record = await createPayrollRecordWithRun({
    tenantId,
    employeeId,
    payrollPeriod: period,
    ...figures,
  });

  // Record each instalment taken and reduce what is still owed.
  for (const line of loanLines) {
    await db.insert(loanRepayments).values({
      loanId: line.loanId,
      payrollRecordId: record.id,
      payrollPeriod: period,
      amount: line.amount.toFixed(2),
    });

    await db
      .update(loans)
      .set({
        balance: sql`greatest(${loans.balance} - ${line.amount.toFixed(2)}::numeric, 0)`,
        status: sql`case when ${loans.balance} - ${line.amount.toFixed(2)}::numeric <= 0.004 then 'closed' else ${loans.status} end`,
        updatedAt: new Date(),
      })
      .where(eq(loans.id, line.loanId));
  }

  await db.insert(payslips).values({
    tenantId,
    employeeId,
    payrollRecordId: record.id,
    payrollPeriod: period,
    basicSalary: figures.basicSalary,
    totalAllowances: figures.totalAllowances,
    totalDeductions: figures.totalDeductions,
    netSalary: figures.netSalary,
  });

  return { outcome: "created", recordId: record.id, netSalary: figures.netSalary };
}
