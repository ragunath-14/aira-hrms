import {
  pgTable,
  uuid,
  text,
  numeric,
  date,
  timestamp,
  unique,
  index,
  uniqueIndex,
  boolean,
  integer,
} from "drizzle-orm/pg-core";

import { tenants } from "./tenants";
import { employees } from "./employees";

export const salaryStructures = pgTable("salary_structures", {
  id: uuid("id").defaultRandom().primaryKey(),

  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, {
      onDelete: "cascade",
    }),

  employeeId: uuid("employee_id")
    .notNull()
    .references(() => employees.id, {
      onDelete: "cascade",
    }),

  basicSalary: numeric("basic_salary", {
    precision: 12,
    scale: 2,
  }).notNull(),

  effectiveFrom: date("effective_from").notNull(),

  effectiveTo: date("effective_to"),

  status: text("status")
    .notNull()
    .default("active"),

  createdAt: timestamp("created_at")
    .defaultNow()
    .notNull(),

  updatedAt: timestamp("updated_at")
    .defaultNow()
    .notNull(),
}, (table) => [
  index("salary_structures_tenant_id_idx").on(table.tenantId),
  index("salary_structures_employee_id_idx").on(table.employeeId),
]);

export const salaryComponents = pgTable("salary_components", {
  id: uuid("id").defaultRandom().primaryKey(),

  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, {
      onDelete: "cascade",
    }),

  // Null = applies to everyone in the company; otherwise only to this employee.
  employeeId: uuid("employee_id").references(() => employees.id, {
    onDelete: "cascade",
  }),

  name: text("name").notNull(),

  type: text("type").notNull(),

  amount: numeric("amount", {
    precision: 12,
    scale: 2,
  }).notNull(),

  createdAt: timestamp("created_at")
    .defaultNow()
    .notNull(),

  updatedAt: timestamp("updated_at")
    .defaultNow()
    .notNull(),
}, (table) => [index("salary_components_tenant_id_idx").on(table.tenantId)]);

export const payrollRuns = pgTable(
  "payroll_runs",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, {
        onDelete: "cascade",
      }),

    payrollPeriod: text("payroll_period").notNull(),

    status: text("status").notNull().default("processing"),

    totalNetPay: numeric("total_net_pay", {
      precision: 14,
      scale: 2,
    })
      .notNull()
      .default("0"),

    processedAt: timestamp("processed_at")
      .defaultNow()
      .notNull(),

    createdAt: timestamp("created_at")
      .defaultNow()
      .notNull(),

    updatedAt: timestamp("updated_at")
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    tenantPeriodUnique: unique().on(
      table.tenantId,
      table.payrollPeriod,
    ),
    tenantIdIdx: index("payroll_runs_tenant_id_idx").on(table.tenantId),
  }),
);

export const payrollRecords = pgTable("payroll_records", {
  id: uuid("id").defaultRandom().primaryKey(),

  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, {
      onDelete: "cascade",
    }),

  employeeId: uuid("employee_id")
    .notNull()
    .references(() => employees.id, {
      onDelete: "cascade",
    }),

  payrollPeriod: text("payroll_period").notNull(),

  basicSalary: numeric("basic_salary", {
    precision: 12,
    scale: 2,
  }).notNull(),

  totalAllowances: numeric("total_allowances", {
    precision: 12,
    scale: 2,
  }).notNull().default("0"),

  totalDeductions: numeric("total_deductions", {
    precision: 12,
    scale: 2,
  }).notNull().default("0"),

  netSalary: numeric("net_salary", {
    precision: 12,
    scale: 2,
  }).notNull(),

  // Statutory figures. total_deductions already includes the employee's share
  // of PF, ESI, professional tax and TDS; these columns keep the breakdown and
  // the employer's own contributions for the monthly statutory report.
  // Days. Filled when payroll is linked to attendance: the days of the month,
  // the days paid, and the loss-of-pay days that were taken off.
  daysInPeriod: integer("days_in_period").notNull().default(0),
  paidDays: numeric("paid_days", { precision: 5, scale: 2 }).notNull().default("0"),
  lopDays: numeric("lop_days", { precision: 5, scale: 2 }).notNull().default("0"),

  overtimeHours: numeric("overtime_hours", { precision: 6, scale: 2 }).notNull().default("0"),
  overtimePay: numeric("overtime_pay", { precision: 12, scale: 2 }).notNull().default("0"),

  // One-off earnings (bonus, arrears) added and one-off deductions taken this
  // month, and the loan / advance instalment recovered.
  adjustmentEarnings: numeric("adjustment_earnings", { precision: 12, scale: 2 }).notNull().default("0"),
  adjustmentDeductions: numeric("adjustment_deductions", { precision: 12, scale: 2 }).notNull().default("0"),
  loanDeduction: numeric("loan_deduction", { precision: 12, scale: 2 }).notNull().default("0"),

  // Labour Welfare Fund.
  lwfEmployee: numeric("lwf_employee", { precision: 12, scale: 2 }).notNull().default("0"),
  lwfEmployer: numeric("lwf_employer", { precision: 12, scale: 2 }).notNull().default("0"),

  pfWage: numeric("pf_wage", { precision: 12, scale: 2 }).notNull().default("0"),
  pfEmployee: numeric("pf_employee", { precision: 12, scale: 2 }).notNull().default("0"),
  pfEmployer: numeric("pf_employer", { precision: 12, scale: 2 }).notNull().default("0"),
  esiWage: numeric("esi_wage", { precision: 12, scale: 2 }).notNull().default("0"),
  esiEmployee: numeric("esi_employee", { precision: 12, scale: 2 }).notNull().default("0"),
  esiEmployer: numeric("esi_employer", { precision: 12, scale: 2 }).notNull().default("0"),
  professionalTax: numeric("professional_tax", { precision: 12, scale: 2 }).notNull().default("0"),
  tds: numeric("tds", { precision: 12, scale: 2 }).notNull().default("0"),

  status: text("status")
    .notNull()
    .default("processed"),

  createdAt: timestamp("created_at")
    .defaultNow()
    .notNull(),

  updatedAt: timestamp("updated_at")
    .defaultNow()
    .notNull(),
}, (table) => [
  index("payroll_records_tenant_id_idx").on(table.tenantId),
  index("payroll_records_employee_id_idx").on(table.employeeId),
  uniqueIndex("payroll_records_employee_period_uidx").on(table.tenantId, table.employeeId, table.payrollPeriod),
]);

export const payrollItems = pgTable("payroll_items", {
  id: uuid("id").defaultRandom().primaryKey(),

  payrollRunId: uuid("payroll_run_id")
    .notNull()
    .references(() => payrollRuns.id, {
      onDelete: "cascade",
    }),

  payrollRecordId: uuid("payroll_record_id")
    .notNull()
    .references(() => payrollRecords.id, {
      onDelete: "cascade",
    }),

  employeeId: uuid("employee_id")
    .notNull()
    .references(() => employees.id, {
      onDelete: "cascade",
    }),

  basicSalary: numeric("basic_salary", {
    precision: 12,
    scale: 2,
  }).notNull(),

  totalAllowances: numeric("total_allowances", {
    precision: 12,
    scale: 2,
  }).notNull().default("0"),

  totalDeductions: numeric("total_deductions", {
    precision: 12,
    scale: 2,
  }).notNull().default("0"),

  netSalary: numeric("net_salary", {
    precision: 12,
    scale: 2,
  }).notNull(),

  createdAt: timestamp("created_at")
    .defaultNow()
    .notNull(),
}, (table) => [
  index("payroll_items_payroll_run_id_idx").on(table.payrollRunId),
  index("payroll_items_payroll_record_id_idx").on(table.payrollRecordId),
  index("payroll_items_employee_id_idx").on(table.employeeId),
]);

export const payslips = pgTable("payslips", {
  id: uuid("id").defaultRandom().primaryKey(),

  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, {
      onDelete: "cascade",
    }),

  employeeId: uuid("employee_id")
    .notNull()
    .references(() => employees.id, {
      onDelete: "cascade",
    }),

  payrollRecordId: uuid("payroll_record_id")
    .notNull()
    .references(() => payrollRecords.id, {
      onDelete: "cascade",
    }),

  payrollPeriod: text("payroll_period").notNull(),

  basicSalary: numeric("basic_salary", {
    precision: 12,
    scale: 2,
  }).notNull(),

  totalAllowances: numeric("total_allowances", {
    precision: 12,
    scale: 2,
  }).notNull().default("0"),

  totalDeductions: numeric("total_deductions", {
    precision: 12,
    scale: 2,
  }).notNull().default("0"),

  netSalary: numeric("net_salary", {
    precision: 12,
    scale: 2,
  }).notNull(),

  generatedAt: timestamp("generated_at")
    .defaultNow()
    .notNull(),
}, (table) => [
  index("payslips_tenant_id_idx").on(table.tenantId),
  index("payslips_employee_id_idx").on(table.employeeId),
  uniqueIndex("payslips_record_uidx").on(table.payrollRecordId),
]);

// Per-employee statutory details: identifiers for the PF / ESI returns, which
// schemes apply to them, and the income-tax regime used for TDS.
export const employeeStatutory = pgTable("employee_statutory", {
  id: uuid("id").defaultRandom().primaryKey(),

  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),

  employeeId: uuid("employee_id")
    .notNull()
    .references(() => employees.id, { onDelete: "cascade" }),

  pan: text("pan"),
  uan: text("uan"),
  esiNumber: text("esi_number"),

  pfApplicable: boolean("pf_applicable").notNull().default(true),
  esiApplicable: boolean("esi_applicable").notNull().default(true),
  ptApplicable: boolean("pt_applicable").notNull().default(true),

  // Where the salary is paid (for the bank transfer file).
  bankName: text("bank_name"),
  accountNumber: text("account_number"),
  ifsc: text("ifsc"),

  // "new" or "old" income-tax regime.
  taxRegime: text("tax_regime").notNull().default("new"),

  // Old regime only: yearly investments and deductions the employee declared
  // (80C, 80D, HRA exemption, ...). PF and professional tax are added on top.
  declaredDeductions: numeric("declared_deductions", { precision: 12, scale: 2 })
    .notNull()
    .default("0"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("employee_statutory_tenant_id_idx").on(table.tenantId),
  uniqueIndex("employee_statutory_employee_uidx").on(table.tenantId, table.employeeId),
]);

// One-off pay changes for one employee in one month: a bonus or arrears
// (earning) or a recovery (deduction). Applied when that month's payroll runs.
export const payrollAdjustments = pgTable("payroll_adjustments", {
  id: uuid("id").defaultRandom().primaryKey(),

  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),

  employeeId: uuid("employee_id")
    .notNull()
    .references(() => employees.id, { onDelete: "cascade" }),

  payrollPeriod: text("payroll_period").notNull(),

  // "earning" or "deduction"
  kind: text("kind").notNull(),

  label: text("label").notNull(),

  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),

  createdBy: text("created_by"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("payroll_adjustments_tenant_period_idx").on(table.tenantId, table.payrollPeriod),
  index("payroll_adjustments_employee_idx").on(table.employeeId),
]);

// Loans and salary advances, recovered in equal monthly instalments through
// payroll until the balance reaches zero.
export const loans = pgTable("loans", {
  id: uuid("id").defaultRandom().primaryKey(),

  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),

  employeeId: uuid("employee_id")
    .notNull()
    .references(() => employees.id, { onDelete: "cascade" }),

  // "loan" or "advance"
  kind: text("kind").notNull().default("advance"),

  principal: numeric("principal", { precision: 12, scale: 2 }).notNull(),

  installments: integer("installments").notNull(),

  installmentAmount: numeric("installment_amount", { precision: 12, scale: 2 }).notNull(),

  // First payroll month the instalment is taken (YYYY-MM).
  startPeriod: text("start_period").notNull(),

  balance: numeric("balance", { precision: 12, scale: 2 }).notNull(),

  // "active" or "closed"
  status: text("status").notNull().default("active"),

  note: text("note"),

  createdBy: text("created_by"),

  createdAt: timestamp("created_at").defaultNow().notNull(),

  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("loans_tenant_id_idx").on(table.tenantId),
  index("loans_employee_id_idx").on(table.employeeId),
]);

export const loanRepayments = pgTable("loan_repayments", {
  id: uuid("id").defaultRandom().primaryKey(),

  loanId: uuid("loan_id")
    .notNull()
    .references(() => loans.id, { onDelete: "cascade" }),

  payrollRecordId: uuid("payroll_record_id")
    .notNull()
    .references(() => payrollRecords.id, { onDelete: "cascade" }),

  payrollPeriod: text("payroll_period").notNull(),

  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),

  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("loan_repayments_loan_period_uidx").on(table.loanId, table.payrollPeriod),
]);
