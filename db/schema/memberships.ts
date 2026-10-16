import {
  pgTable,
  text,
  timestamp,
  uuid,
  unique,
  index,
} from "drizzle-orm/pg-core";

import { tenants } from "./tenants";
import { customRoles } from "./custom-roles";
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

    // The built-in role this person acts as. When they were given a custom
    // role it is that role's base role, so everything that checks `role` keeps
    // working; customRoleId then narrows what they may do.
    role: text("role").notNull(),

    customRoleId: uuid("custom_role_id").references(() => customRoles.id),

    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    userTenantUnique: unique().on(table.userId, table.tenantId),
    tenantIdIdx: index("memberships_tenant_id_idx").on(table.tenantId),
  }),
);