import { and, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { payrollItems, payrollRecords, payrollRuns } from "@/db/schema";

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
