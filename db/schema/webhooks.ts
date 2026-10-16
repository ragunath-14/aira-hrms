import { index, integer, jsonb, pgTable, text, timestamp, uuid, boolean } from "drizzle-orm/pg-core";

import { tenants } from "./tenants";

// Where AIRA tells a company's own system that something happened (a new
// application, a stage change). One per company. The secret signs every call so
// the receiver can tell it really came from AIRA.
export const webhookEndpoints = pgTable("webhook_endpoints", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id")
    .notNull()
    .unique()
    .references(() => tenants.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  secret: text("secret").notNull(),
  enabled: boolean("enabled").notNull().default(true),
  // In a row, so a dead receiver is switched off instead of retried forever.
  consecutiveFailures: integer("consecutive_failures").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// One message to send, and how it went. Kept so the company can see what was
// sent and so a failed one can be tried again.
export const webhookDeliveries = pgTable(
  "webhook_deliveries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    event: text("event").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    // pending | delivered | failed
    status: text("status").notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    nextAttemptAt: timestamp("next_attempt_at").defaultNow().notNull(),
    responseStatus: integer("response_status"),
    lastError: text("last_error"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    deliveredAt: timestamp("delivered_at"),
  },
  (t) => [
    index("webhook_deliveries_tenant_idx").on(t.tenantId, t.createdAt),
    index("webhook_deliveries_due_idx").on(t.status, t.nextAttemptAt),
  ],
);
