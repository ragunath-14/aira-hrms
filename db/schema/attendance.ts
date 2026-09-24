import {
  pgEnum,
  pgTable,
  uuid,
  date,
  timestamp,
  text,
  unique,
  index,
} from "drizzle-orm/pg-core";

import { tenants } from "./tenants";
import { employees } from "./employees";

export const attendanceStatusEnum = pgEnum("attendance_status", [
  "present",
  "absent",
  "late",
  "half_day",
  "leave",
  "holiday",
]);

export const attendance = pgTable(
  "attendance",
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

    attendanceDate: date("attendance_date").notNull(),

    checkIn: timestamp("check_in"),
    checkOut: timestamp("check_out"),

    status: attendanceStatusEnum("status")
      .notNull()
      .default("present"),

    notes: text("notes"),

    createdAt: timestamp("created_at")
      .defaultNow()
      .notNull(),

    updatedAt: timestamp("updated_at")
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    employeeDateUnique: unique().on(
      table.employeeId,
      table.attendanceDate,
    ),
    tenantIdIdx: index("attendance_tenant_id_idx").on(table.tenantId),
  }),
);