import {
  boolean,
  index,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { tenants } from "./tenants";
import { users } from "./users";
import { locations } from "./organization";

// Company holiday calendar. `date` is a plain YYYY-MM-DD string so it never
// shifts across time zones.
export const holidays = pgTable(
  "holidays",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),

    name: text("name").notNull(),

    date: text("date").notNull(),

    // "public" | "optional" | "company"
    type: text("type").notNull().default("public"),

    description: text("description"),

    // Null = the whole company; otherwise only people working at this location.
    locationId: uuid("location_id").references(() => locations.id, { onDelete: "cascade" }),

    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("holidays_tenant_id_idx").on(table.tenantId),
    index("holidays_tenant_date_idx").on(table.tenantId, table.date),
  ],
);

// Company-wide announcements posted by HR.
export const announcements = pgTable(
  "announcements",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),

    title: text("title").notNull(),

    body: text("body").notNull(),

    pinned: boolean("pinned").notNull().default(false),

    createdBy: uuid("created_by").references(() => users.id, {
      onDelete: "set null",
    }),

    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("announcements_tenant_id_idx").on(table.tenantId),
  ],
);
