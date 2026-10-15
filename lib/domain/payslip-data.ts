import { and, eq, isNull, or } from "drizzle-orm";

import { db } from "@/db";
import { employees } from "@/db/schema/employees";
import { departments, designations, locations } from "@/db/schema/organization";
import { employeeStatutory, loanRepayments, loans, payrollAdjustments, payrollRecords, payslips, salaryComponents } from "@/db/schema/payroll";
import { tenants } from "@/db/schema/tenants";
import { resolveSettings } from "@/lib/config/settings";
import { buildPayslipPdf } from "@/lib/domain/payslip-pdf";
import { formatDate } from "@/lib/format/date";

// Loads one payslip with everything the PDF needs and renders it. Returns null
// when the payslip does not exist in this company (or, when `onlyEmployeeId`
// is given, does not belong to that employee).
export async function renderPayslip(params: {
  tenantId: string;
  payslipId: string;
  onlyEmployeeId?: string;
}) {
  const [row] = await db
    .select()
    .from(payslips)
    .where(
      and(
        eq(payslips.id, params.payslipId),
        eq(payslips.tenantId, params.tenantId),
        params.onlyEmployeeId ? eq(payslips.employeeId, params.onlyEmployeeId) : undefined,
      ),
    )
    .limit(1);

  if (!row) return null;

  const [[employee], [tenant], components, [record], [identity]] = await Promise.all([
    db
      .select({
        firstName: employees.firstName,
        lastName: employees.lastName,
        code: employees.employeeCode,
        email: employees.email,
        joinedOn: employees.dateOfJoining,
        designation: designations.name,
        department: departments.name,
        location: locations.name,
      })
      .from(employees)
      .leftJoin(designations, eq(designations.id, employees.designationId))
      .leftJoin(departments, eq(departments.id, employees.departmentId))
      .leftJoin(locations, eq(locations.id, employees.locationId))
      .where(eq(employees.id, row.employeeId))
      .limit(1),
    db.select().from(tenants).where(eq(tenants.id, params.tenantId)).limit(1),
    db
      .select()
      .from(salaryComponents)
      .where(
        and(
          eq(salaryComponents.tenantId, params.tenantId),
          or(isNull(salaryComponents.employeeId), eq(salaryComponents.employeeId, row.employeeId)),
        ),
      ),
    db.select().from(payrollRecords).where(eq(payrollRecords.id, row.payrollRecordId)).limit(1),
    db
      .select({ pan: employeeStatutory.pan, uan: employeeStatutory.uan })
      .from(employeeStatutory)
      .where(
        and(
          eq(employeeStatutory.tenantId, params.tenantId),
          eq(employeeStatutory.employeeId, row.employeeId),
        ),
      )
      .limit(1),
  ]);

  if (!employee || !tenant) return null;

  const [adjustments, loanLines] = await Promise.all([
    db
      .select({ kind: payrollAdjustments.kind, label: payrollAdjustments.label, amount: payrollAdjustments.amount })
      .from(payrollAdjustments)
      .where(
        and(
          eq(payrollAdjustments.tenantId, params.tenantId),
          eq(payrollAdjustments.employeeId, row.employeeId),
          eq(payrollAdjustments.payrollPeriod, row.payrollPeriod),
        ),
      ),
    record
      ? db
          .select({ kind: loans.kind, amount: loanRepayments.amount })
          .from(loanRepayments)
          .innerJoin(loans, eq(loans.id, loanRepayments.loanId))
          .where(eq(loanRepayments.payrollRecordId, record.id))
      : Promise.resolve([]),
  ]);

  const allowances = Number(row.totalAllowances);
  const deductions = Number(row.totalDeductions);

  const items = (type: string) =>
    components
      .filter((c) => c.type === type)
      .map((c) => ({ name: c.name, amount: Number(c.amount) }));

  const allowanceItems = items("allowance");
  const deductionItems = items("deduction");
  const sum = (list: { amount: number }[]) =>
    Math.round(list.reduce((t, i) => t + i.amount, 0) * 100) / 100;

  const statutory = record
    ? {
        pfEmployee: Number(record.pfEmployee),
        esiEmployee: Number(record.esiEmployee),
        professionalTax: Number(record.professionalTax),
        tds: Number(record.tds),
        pfEmployer: Number(record.pfEmployer),
        esiEmployer: Number(record.esiEmployer),
        lwfEmployee: Number(record.lwfEmployee),
      }
    : undefined;

  const extraEarnings = adjustments
    .filter((a) => a.kind === "earning")
    .map((a) => ({ label: a.label, amount: Number(a.amount) }));
  const extraDeductions = [
    ...loanLines.map((l) => ({
      label: l.kind === "loan" ? "Loan instalment" : "Advance recovery",
      amount: Number(l.amount),
    })),
    ...adjustments
      .filter((a) => a.kind === "deduction")
      .map((a) => ({ label: a.label, amount: Number(a.amount) })),
  ];

  const statutoryTotal = statutory
    ? statutory.pfEmployee + statutory.esiEmployee + statutory.professionalTax + statutory.tds + (statutory.lwfEmployee ?? 0)
    : 0;
  const extrasTotal = extraDeductions.reduce((t, e) => t + e.amount, 0);
  const componentDeductions = Math.round((deductions - statutoryTotal - extrasTotal) * 100) / 100;

  // With loss of pay the salary components were paid in proportion to the days
  // worked, so show them the same way.
  const linked = record && record.daysInPeriod > 0;
  const share = linked ? Number(record.paidDays) / record.daysInPeriod : 1;
  const allowanceLines = allowanceItems.map((item) => ({ ...item, amount: Math.round(item.amount * share * 100) / 100 }));
  const overtimePay = record ? Number(record.overtimePay) : 0;
  const componentAllowances =
    Math.round((allowances - overtimePay - extraEarnings.reduce((t, e) => t + e.amount, 0)) * 100) / 100;

  // The payslip stores totals only. Show the itemised lines when today's salary
  // components still add up to what was paid; otherwise show the totals alone.
  const itemised =
    Math.abs(sum(allowanceLines) - componentAllowances) < 0.05 && sum(deductionItems) === componentDeductions;

  // A payslip shows who it belongs to without printing the whole PAN.
  const pan = identity?.pan ? `${"X".repeat(5)}${identity.pan.slice(5)}` : null;

  const timezone = resolveSettings(tenant.settings).timezone;
  const generated = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(row.generatedAt));

  const name = [employee.firstName, employee.lastName].filter(Boolean).join(" ");

  const pdf = await buildPayslipPdf({
    company: {
      name: tenant.name,
      address: tenant.address,
      city: tenant.city,
      state: tenant.state,
      country: tenant.country,
      phone: tenant.phone,
      email: tenant.email,
    },
    employee: {
      name,
      code: employee.code,
      email: employee.email,
      designation: employee.designation,
      department: employee.department,
      location: employee.location,
      joinedOn: employee.joinedOn ? formatDate(employee.joinedOn) : null,
      pan,
      uan: identity?.uan ?? null,
    },
    period: row.payrollPeriod,
    generatedOn: generated,
    basic: Number(row.basicSalary),
    allowances,
    deductions,
    net: Number(row.netSalary),
    allowanceItems: itemised ? allowanceLines : undefined,
    deductionItems: itemised ? deductionItems : undefined,
    statutory,
    days: linked
      ? { inPeriod: record.daysInPeriod, paid: Number(record.paidDays), lop: Number(record.lopDays) }
      : undefined,
    overtime: overtimePay > 0 ? { hours: Number(record.overtimeHours), pay: overtimePay } : undefined,
    extraEarnings,
    extraDeductions,
  });

  const safeName = name.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "employee";

  return { pdf, filename: `payslip-${row.payrollPeriod}-${safeName}.pdf` };
}
