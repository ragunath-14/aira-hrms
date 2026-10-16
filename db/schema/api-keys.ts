import { index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { tenants } from "./tenants";
import { users } from "./users";

// A key a company creates so its own website or software can connect to AIRA.
// Only a hash is stored, so a key cannot be read back: it is shown once, when
// it is created. A key can do only what its scopes list, and can expire.
export const apiKeys = pgTable(
  "api_keys",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    // The first characters, so people can tell keys apart in the list.
    prefix: text("prefix").notNull(),
    keyHash: text("key_hash").notNull().unique(),
    // jobs:read | applications:write | applications:read
    scopes: jsonb("scopes").$type<string[]>().notNull().default([]),
    // When not empty, the key works only from these server addresses.
    allowedIps: jsonb("allowed_ips").$type<string[]>().notNull().default([]),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    expiresAt: timestamp("expires_at"),
    lastUsedAt: timestamp("last_used_at"),
    revokedAt: timestamp("revoked_at"),
  },
  (t) => [index("api_keys_tenant_idx").on(t.tenantId)],
);
