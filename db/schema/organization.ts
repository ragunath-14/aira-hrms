import {
  pgTable,
  uuid,
  text,
  timestamp,
  index,
  uniqueIndex,
  integer,
  numeric,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

import { tenants } from "./tenants";

export const departments = pgTable("departments", {
  id: uuid("id").defaultRandom().primaryKey(),

  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, {
      onDelete: "cascade",
    }),

  name: text("name").notNull(),

  description: text("description"),

  createdAt: timestamp("created_at")
    .defaultNow()
    .notNull(),

  updatedAt: timestamp("updated_at")
    .defaultNow()
    .notNull(),
}, (table) => [
  index("departments_tenant_id_idx").on(table.tenantId),
  uniqueIndex("departments_tenant_name_uidx").on(table.tenantId, sql`lower(trim(${table.name}))`),
]);

export const designations = pgTable("designations", {
  id: uuid("id").defaultRandom().primaryKey(),

  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, {
      onDelete: "cascade",
    }),

  name: text("name").notNull(),

  description: text("description"),

  createdAt: timestamp("created_at")
    .defaultNow()
    .notNull(),

  updatedAt: timestamp("updated_at")
    .defaultNow()
    .notNull(),
}, (table) => [
  index("designations_tenant_id_idx").on(table.tenantId),
  uniqueIndex("designations_tenant_name_uidx").on(table.tenantId, sql`lower(trim(${table.name}))`),
]);

export const locations = pgTable("locations", {
  id: uuid("id").defaultRandom().primaryKey(),

  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, {
      onDelete: "cascade",
    }),

  name: text("name").notNull(),

  address: text("address"),

  city: text("city"),

  state: text("state"),

  country: text("country"),

  // Where the site is, and how far from it a punch is accepted (metres). All
  // three must be set for the location to be geo-fenced.
  latitude: numeric("latitude", { precision: 9, scale: 6 }),

  longitude: numeric("longitude", { precision: 9, scale: 6 }),

  geofenceRadiusM: integer("geofence_radius_m"),

  createdAt: timestamp("created_at")
    .defaultNow()
    .notNull(),

  updatedAt: timestamp("updated_at")
    .defaultNow()
    .notNull(),
}, (table) => [index("locations_tenant_id_idx").on(table.tenantId)]);