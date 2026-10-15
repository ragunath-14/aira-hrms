import {
  pgEnum,
  pgTable,
  uuid,
  date,
  timestamp,
  text,
  unique,
  index,
  integer,
  numeric,
  primaryKey,
} from "drizzle-orm/pg-core";

import { tenants } from "./tenants";
import { employees } from "./employees";
import { bytea } from "./employee-documents";

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

    // Where the punches were made (browser location) and how far that was from
    // the employee's site, when the company asks for location.
    checkInLat: numeric("check_in_lat", { precision: 9, scale: 6 }),
    checkInLng: numeric("check_in_lng", { precision: 9, scale: 6 }),
    checkInDistanceM: integer("check_in_distance_m"),
    checkOutLat: numeric("check_out_lat", { precision: 9, scale: 6 }),
    checkOutLng: numeric("check_out_lng", { precision: 9, scale: 6 }),
    checkOutDistanceM: integer("check_out_distance_m"),

    // Where the person is working today: "office" or "remote".
    workMode: text("work_mode").notNull().default("office"),

    // Live status shown on the Workplace page: "lunch", "break" or "away"
    // until breakUntil passes (then they count as working again).
    breakType: text("break_type"),
    breakUntil: timestamp("break_until"),

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

// The selfie taken at a punch (when the company asks for one): at most one per
// punch, shrunk in the browser so it stays a few KB.
export const attendancePhotos = pgTable(
  "attendance_photos",
  {
    attendanceId: uuid("attendance_id")
      .notNull()
      .references(() => attendance.id, { onDelete: "cascade" }),

    // "in" or "out"
    kind: text("kind").notNull(),

    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),

    mimeType: text("mime_type").notNull(),

    data: bytea("data").notNull(),

    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.attendanceId, table.kind] }),
    index("attendance_photos_tenant_id_idx").on(table.tenantId),
  ],
);
