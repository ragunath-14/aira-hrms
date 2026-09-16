import {
  pgTable,
  uuid,
  text,
  integer,
  date,
  timestamp,
} from "drizzle-orm/pg-core";

import { tenants } from "./tenants";
import { employees } from "./employees";

export const leaveTypes = pgTable("leave_types", {
  id: uuid("id").defaultRandom().primaryKey(),

  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, {
      onDelete: "cascade",
    }),

  name: text("name").notNull(),

  description: text("description"),

  daysPerYear: integer("days_per_year")
    .notNull()
    .default(0),

  isActive: text("is_active")
    .notNull()
    .default("true"),

  createdAt: timestamp("created_at")
    .defaultNow()
    .notNull(),

  updatedAt: timestamp("updated_at")
    .defaultNow()
    .notNull(),
});

export const leaveBalances = pgTable("leave_balances", {
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

  leaveTypeId: uuid("leave_type_id")
    .notNull()
    .references(() => leaveTypes.id, {
      onDelete: "cascade",
    }),

  year: integer("year").notNull(),

  allocatedDays: integer("allocated_days")
    .notNull()
    .default(0),

  usedDays: integer("used_days")
    .notNull()
    .default(0),

  remainingDays: integer("remaining_days")
    .notNull()
    .default(0),

  createdAt: timestamp("created_at")
    .defaultNow()
    .notNull(),

  updatedAt: timestamp("updated_at")
    .defaultNow()
    .notNull(),
});

export const leaveRequests = pgTable("leave_requests", {
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

  leaveTypeId: uuid("leave_type_id")
    .notNull()
    .references(() => leaveTypes.id, {
      onDelete: "cascade",
    }),

  startDate: date("start_date").notNull(),

  endDate: date("end_date").notNull(),

  totalDays: integer("total_days").notNull(),

  reason: text("reason"),

  status: text("status")
    .notNull()
    .default("pending"),

  managerId: uuid("manager_id")
    .references(() => employees.id, {
      onDelete: "set null",
    }),

  managerComment: text("manager_comment"),

  createdAt: timestamp("created_at")
    .defaultNow()
    .notNull(),

  updatedAt: timestamp("updated_at")
    .defaultNow()
    .notNull(),
});