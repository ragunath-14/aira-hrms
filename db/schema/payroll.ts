import {
  pgTable,
  uuid,
  text,
  numeric,
  date,
  timestamp,
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
});

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
});

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
});

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
});