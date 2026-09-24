import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  numeric,
  date,
  timestamp,
  index,
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

  // Reference info surfaced to employees as "Leave Rules" — no dedicated
  // table needed, these just ride along on the existing leave type.
  carryForwardLimit: integer("carry_forward_limit"),

  maxConsecutiveDays: integer("max_consecutive_days"),

  minNoticeDays: integer("min_notice_days"),

  encashmentAllowed: boolean("encashment_allowed")
    .notNull()
    .default(false),

  rulesText: text("rules_text"),

  createdAt: timestamp("created_at")
    .defaultNow()
    .notNull(),

  updatedAt: timestamp("updated_at")
    .defaultNow()
    .notNull(),
}, (table) => [index("leave_types_tenant_id_idx").on(table.tenantId)]);

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
}, (table) => [
  index("leave_balances_tenant_id_idx").on(table.tenantId),
  index("leave_balances_employee_id_idx").on(table.employeeId),
  index("leave_balances_leave_type_id_idx").on(table.leaveTypeId),
]);

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
}, (table) => [
  index("leave_requests_tenant_id_idx").on(table.tenantId),
  index("leave_requests_employee_id_idx").on(table.employeeId),
  index("leave_requests_leave_type_id_idx").on(table.leaveTypeId),
  index("leave_requests_status_idx").on(table.status),
]);

// Personal, unapproved placeholder for leave an employee intends to take
// later ("Leave Planner") — distinct from leaveRequests, which is the
// actual approval workflow.
export const leavePlans = pgTable("leave_plans", {
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

  leaveTypeId: uuid("leave_type_id").references(
    () => leaveTypes.id,
    {
      onDelete: "set null",
    },
  ),

  startDate: date("start_date").notNull(),

  endDate: date("end_date").notNull(),

  note: text("note"),

  status: text("status")
    .notNull()
    .default("planned"),

  createdAt: timestamp("created_at")
    .defaultNow()
    .notNull(),

  updatedAt: timestamp("updated_at")
    .defaultNow()
    .notNull(),
}, (table) => [
  index("leave_plans_tenant_id_idx").on(table.tenantId),
  index("leave_plans_employee_id_idx").on(table.employeeId),
]);

export const leaveEncashmentRequests = pgTable(
  "leave_encashment_requests",
  {
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

    daysRequested: integer("days_requested").notNull(),

    reason: text("reason"),

    status: text("status")
      .notNull()
      .default("pending"),

    managerId: uuid("manager_id").references(
      () => employees.id,
      {
        onDelete: "set null",
      },
    ),

    managerComment: text("manager_comment"),

    createdAt: timestamp("created_at")
      .defaultNow()
      .notNull(),

    updatedAt: timestamp("updated_at")
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("leave_encashment_requests_tenant_id_idx").on(table.tenantId),
    index("leave_encashment_requests_employee_id_idx").on(table.employeeId),
    index("leave_encashment_requests_status_idx").on(table.status),
  ],
);

export const leaveAdjustmentRequests = pgTable(
  "leave_adjustment_requests",
  {
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

    // Signed: positive credits days back, negative corrects an
    // over-allocation.
    requestedDays: integer("requested_days").notNull(),

    reason: text("reason"),

    status: text("status")
      .notNull()
      .default("pending"),

    managerId: uuid("manager_id").references(
      () => employees.id,
      {
        onDelete: "set null",
      },
    ),

    managerComment: text("manager_comment"),

    createdAt: timestamp("created_at")
      .defaultNow()
      .notNull(),

    updatedAt: timestamp("updated_at")
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("leave_adjustment_requests_tenant_id_idx").on(table.tenantId),
    index("leave_adjustment_requests_employee_id_idx").on(table.employeeId),
    index("leave_adjustment_requests_status_idx").on(table.status),
  ],
);

// Leave Travel Concession claims — tracks the expense reimbursement only;
// the time off itself is booked separately through leaveRequests.
export const ltcClaims = pgTable("ltc_claims", {
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

  blockYear: text("block_year").notNull(),

  travelStartDate: date("travel_start_date"),

  travelEndDate: date("travel_end_date"),

  destination: text("destination"),

  amountClaimed: numeric("amount_claimed", {
    precision: 12,
    scale: 2,
  }).notNull(),

  proofUrl: text("proof_url"),

  reason: text("reason"),

  status: text("status")
    .notNull()
    .default("pending"),

  managerId: uuid("manager_id").references(
    () => employees.id,
    {
      onDelete: "set null",
    },
  ),

  managerComment: text("manager_comment"),

  createdAt: timestamp("created_at")
    .defaultNow()
    .notNull(),

  updatedAt: timestamp("updated_at")
    .defaultNow()
    .notNull(),
}, (table) => [
  index("ltc_claims_tenant_id_idx").on(table.tenantId),
  index("ltc_claims_employee_id_idx").on(table.employeeId),
  index("ltc_claims_status_idx").on(table.status),
]);