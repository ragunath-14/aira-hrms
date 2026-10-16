import { index, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

import { tenants } from "./tenants";

// A company's own role: a name plus what that role may do, on top of one of the
// built-in roles (its "base role"). It can only take access away from the base
// role, never add to it, so a custom role can never reach further than the
// built-in role it starts from. See lib/auth/custom-roles.ts.
export const customRoles = pgTable("custom_roles", {
  id: uuid("id").defaultRandom().primaryKey(),

  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),

  name: text("name").notNull(),

  // "admin", "hr" or "manager": the built-in role people with this role act as.
  baseRole: text("base_role").notNull(),

  // { module: ["view", "create", "edit", "delete"] } - what is allowed.
  permissions: jsonb("permissions")
    .$type<Record<string, string[]>>()
    .notNull()
    .default({}),

  createdAt: timestamp("created_at").defaultNow().notNull(),

  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("custom_roles_tenant_id_idx").on(table.tenantId),
  uniqueIndex("custom_roles_tenant_name_uidx").on(table.tenantId, sql`lower(trim(${table.name}))`),
]);
