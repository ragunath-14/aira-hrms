import {
  boolean,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { tenants } from "./tenants";
import { users } from "./users";

export const notifications = pgTable("notifications", {
  id: uuid("id").defaultRandom().primaryKey(),

  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, {
      onDelete: "cascade",
    }),

  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, {
      onDelete: "cascade",
    }),

  type: text("type").notNull(),

  title: text("title").notNull(),

  message: text("message").notNull(),

  isRead: boolean("is_read").notNull().default(false),

  createdAt: timestamp("created_at")
    .notNull()
    .defaultNow(),
});