import {
  boolean,
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

import { tenants } from "./tenants";
import { users } from "./users";
import { employees } from "./employees";
import { departments } from "./organization";

const tenantFk = () =>
  uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" });

const employeeFk = () =>
  uuid("employee_id")
    .notNull()
    .references(() => employees.id, { onDelete: "cascade" });

// ---- Expense claims -------------------------------------------------------
export const expenseClaims = pgTable(
  "expense_claims",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: tenantFk(),
    employeeId: employeeFk(),
    category: text("category").notNull(),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    expenseDate: text("expense_date").notNull(),
    description: text("description"),
    // pending | approved | rejected | paid
    status: text("status").notNull().default("pending"),
    reviewedBy: uuid("reviewed_by").references(() => users.id, {
      onDelete: "set null",
    }),
    reviewNote: text("review_note"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("expense_claims_tenant_idx").on(t.tenantId),
    index("expense_claims_employee_idx").on(t.employeeId),
  ],
);

// ---- Recruitment ----------------------------------------------------------
export const jobOpenings = pgTable(
  "job_openings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: tenantFk(),
    title: text("title").notNull(),
    departmentId: uuid("department_id").references(() => departments.id, {
      onDelete: "set null",
    }),
    location: text("location"),
    // full_time | part_time | contract | intern
    employmentType: text("employment_type").notNull().default("full_time"),
    openings: integer("openings").notNull().default(1),
    // open | closed
    status: text("status").notNull().default("open"),
    description: text("description"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("job_openings_tenant_idx").on(t.tenantId)],
);

export const candidates = pgTable(
  "candidates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: tenantFk(),
    jobId: uuid("job_id")
      .notNull()
      .references(() => jobOpenings.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    email: text("email").notNull(),
    phone: text("phone"),
    // applied | screening | interview | offer | hired | rejected
    stage: text("stage").notNull().default("applied"),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("candidates_tenant_idx").on(t.tenantId),
    index("candidates_job_idx").on(t.jobId),
  ],
);

// ---- Onboarding / offboarding checklists ---------------------------------
export const onboardingTasks = pgTable(
  "onboarding_tasks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: tenantFk(),
    employeeId: employeeFk(),
    // onboarding | offboarding
    kind: text("kind").notNull().default("onboarding"),
    title: text("title").notNull(),
    dueDate: text("due_date"),
    done: boolean("done").notNull().default(false),
    doneAt: timestamp("done_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("onboarding_tasks_tenant_idx").on(t.tenantId),
    index("onboarding_tasks_employee_idx").on(t.employeeId),
  ],
);

// ---- Shift scheduling -----------------------------------------------------
export const shifts = pgTable(
  "shifts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: tenantFk(),
    name: text("name").notNull(),
    // HH:MM, 24-hour
    startTime: text("start_time").notNull(),
    endTime: text("end_time").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("shifts_tenant_idx").on(t.tenantId)],
);

export const shiftAssignments = pgTable(
  "shift_assignments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: tenantFk(),
    employeeId: employeeFk(),
    shiftId: uuid("shift_id")
      .notNull()
      .references(() => shifts.id, { onDelete: "cascade" }),
    // YYYY-MM-DD
    date: text("date").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("shift_assignments_tenant_date_idx").on(t.tenantId, t.date),
    unique("shift_assignments_employee_date_uq").on(t.employeeId, t.date),
  ],
);

// ---- Helpdesk -------------------------------------------------------------
export const tickets = pgTable(
  "tickets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: tenantFk(),
    employeeId: employeeFk(),
    subject: text("subject").notNull(),
    // payroll | leave | it | policy | other
    category: text("category").notNull().default("other"),
    // low | medium | high
    priority: text("priority").notNull().default("medium"),
    // open | in_progress | resolved | closed
    status: text("status").notNull().default("open"),
    description: text("description").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    index("tickets_tenant_idx").on(t.tenantId),
    index("tickets_employee_idx").on(t.employeeId),
  ],
);

export const ticketComments = pgTable(
  "ticket_comments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: tenantFk(),
    ticketId: uuid("ticket_id")
      .notNull()
      .references(() => tickets.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    body: text("body").notNull(),
    // Set when the author deletes the message ("delete for everyone"): the text
    // is erased and the thread shows "This message was deleted".
    deletedAt: timestamp("deleted_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("ticket_comments_ticket_idx").on(t.ticketId)],
);
