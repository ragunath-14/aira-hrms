import {
  pgTable,
  text,
  timestamp,
  uuid,
  unique,
  index,
} from "drizzle-orm/pg-core";

import { tenants } from "./tenants";
import { users } from "./users";

export const memberships = pgTable(
  "memberships",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),

    role: text("role").notNull(),

    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    userTenantUnique: unique().on(table.userId, table.tenantId),
    tenantIdIdx: index("memberships_tenant_id_idx").on(table.tenantId),
  }),
);