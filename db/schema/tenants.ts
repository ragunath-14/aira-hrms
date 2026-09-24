import { pgTable, text, timestamp, uuid, jsonb } from "drizzle-orm/pg-core";

export const tenants = pgTable("tenants", {
  id: uuid("id").defaultRandom().primaryKey(),

  name: text("name").notNull(),

  slug: text("slug").notNull().unique(),

  email: text("email"),

  phone: text("phone"),

  website: text("website"),

  address: text("address"),

  city: text("city"),

  state: text("state"),

  country: text("country"),

  logo: text("logo"),

  settings: jsonb("settings")
    .$type<Record<string, unknown>>()
    .notNull()
    .default({}),

  createdAt: timestamp("created_at").defaultNow().notNull(),

  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});