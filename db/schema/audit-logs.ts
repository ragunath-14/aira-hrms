import {
  pgTable,
  uuid,
  text,
  timestamp,
  index,
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
}, (table) => [
  index("audit_logs_tenant_id_idx").on(table.tenantId),
  index("audit_logs_user_id_idx").on(table.userId),
]);
