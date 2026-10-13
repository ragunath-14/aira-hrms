import {
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { employees } from "./employees";
import { tenants } from "./tenants";

// Video meetings and calls scheduled from the Workplace page. The video room
// itself is hosted by the configured meeting service (Jitsi Meet by default);
// we store the unguessable room name and who is invited.
export const meetings = pgTable(
  "meetings",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),

    organizerId: uuid("organizer_id")
      .notNull()
      .references(() => employees.id, { onDelete: "cascade" }),

    title: text("title").notNull(),

    description: text("description"),

    // "instant" (Meet Now) | "scheduled" | "call" (one-to-one)
    kind: text("kind").notNull().default("scheduled"),

    startsAt: timestamp("starts_at").notNull(),

    durationMinutes: integer("duration_minutes").notNull().default(30),

    room: text("room").notNull().unique(),

    // "scheduled" | "cancelled"
    status: text("status").notNull().default("scheduled"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("meetings_tenant_starts_idx").on(table.tenantId, table.startsAt),
  ],
);

export const meetingAttendees = pgTable(
  "meeting_attendees",
  {
    meetingId: uuid("meeting_id")
      .notNull()
      .references(() => meetings.id, { onDelete: "cascade" }),

    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employees.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.meetingId, table.employeeId] }),
    index("meeting_attendees_employee_idx").on(table.employeeId),
  ],
);
