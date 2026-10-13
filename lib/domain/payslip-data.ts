import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { employees } from "@/db/schema/employees";
import { departments, designations, locations } from "@/db/schema/organization";
import { payslips, salaryComponents } from "@/db/schema/payroll";
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

  const [[employee], [tenant], components] = await Promise.all([
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
    db.select().from(salaryComponents).where(eq(salaryComponents.tenantId, params.tenantId)),
  ]);

  if (!employee || !tenant) return null;

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

  // The payslip stores totals only. Show the itemised lines when today's salary
  // components still add up to what was paid; otherwise show the totals alone.
  const itemised = sum(allowanceItems) === allowances && sum(deductionItems) === deductions;

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
    },
    period: row.payrollPeriod,
    generatedOn: generated,
    basic: Number(row.basicSalary),
    allowances,
    deductions,
    net: Number(row.netSalary),
    allowanceItems: itemised ? allowanceItems : undefined,
    deductionItems: itemised ? deductionItems : undefined,
  });

  const safeName = name.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "employee";

  return { pdf, filename: `payslip-${row.payrollPeriod}-${safeName}.pdf` };
}
