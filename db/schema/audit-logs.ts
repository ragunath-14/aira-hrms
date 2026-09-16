import {
  pgTable,
  uuid,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

import { tenants } from "./tenants";
import { users } from "./users";

export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").defaultRandom().primaryKey(),

  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, {
      onDelete: "cascade",
    }),

  userId: uuid("user_id")
    .references(() => users.id, {
      onDelete: "set null",
    }),

  action: text("action").notNull(),

  entity: text("entity").notNull(),

  entityId: text("entity_id"),

  createdAt: timestamp("created_at")
    .defaultNow()
    .notNull(),
});
