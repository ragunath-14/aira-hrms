import {
  boolean,
  pgTable,
  text,
  timestamp,
  uuid,
  index,
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

  // Optional address to open from the notification (e.g. a meeting room).
  link: text("link"),

  isRead: boolean("is_read").notNull().default(false),

  createdAt: timestamp("created_at")
    .notNull()
    .defaultNow(),
}, (table) => [
  index("notifications_tenant_id_idx").on(table.tenantId),
  index("notifications_user_id_idx").on(table.userId),
]);