import { and, desc, eq, gte, isNull, lte, or, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  payrollItems,
  payrollRecords,
  payrollRuns,
  payslips,
  salaryComponents,
  salaryStructures,
} from "@/db/schema";

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

// Works out one employee's pay for a month from their active salary
// structure plus the company's salary components. Nothing here comes from the
// browser, so the figures cannot be tampered with.
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

  const [totals] = await db
    .select({
      allowances: sql<string>`coalesce(sum(case when ${salaryComponents.type} = 'allowance' then ${salaryComponents.amount} else 0 end), 0)`,
      deductions: sql<string>`coalesce(sum(case when ${salaryComponents.type} = 'deduction' then ${salaryComponents.amount} else 0 end), 0)`,
    })
    .from(salaryComponents)
    .where(eq(salaryComponents.tenantId, tenantId));

  const basic = Number(structure.basicSalary);
  const allowances = Number(totals?.allowances ?? 0);
  const deductions = Number(totals?.deductions ?? 0);

  return {
    basicSalary: basic.toFixed(2),
    totalAllowances: allowances.toFixed(2),
    totalDeductions: deductions.toFixed(2),
    netSalary: (basic + allowances - deductions).toFixed(2),
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

  const figures = await calculatePayroll(tenantId, employeeId, period);

  if (!figures) return { outcome: "no_structure" };

  const record = await createPayrollRecordWithRun({
    tenantId,
    employeeId,
    payrollPeriod: period,
    ...figures,
  });

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
