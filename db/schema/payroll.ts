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