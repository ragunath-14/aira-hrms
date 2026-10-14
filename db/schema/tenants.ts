import { pgTable, text, timestamp, uuid, jsonb, integer } from "drizzle-orm/pg-core";

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

  // Platform-owner approval: "pending" until the HRMS owner approves the
  // company's sign-up. Existing and operator-created companies default to
  // "approved"; self-service sign-ups are created as "pending".
  accessStatus: text("access_status").notNull().default("approved"),

  accessReviewedAt: timestamp("access_reviewed_at"),

  accessReviewedBy: uuid("access_reviewed_by"),

  accessNote: text("access_note"),

  // Subscription plan. The plan names a set of default limits (lib/config/plans.ts);
  // the three overrides below let the platform owner give one company different
  // limits. Null means "use the plan's value".
  plan: text("plan").notNull().default("starter"),

  planEmployeeLimit: integer("plan_employee_limit"),

  planStorageMb: integer("plan_storage_mb"),

  planExpiresAt: timestamp("plan_expires_at"),

  settings: jsonb("settings")
    .$type<Record<string, unknown>>()
    .notNull()
    .default({}),

  createdAt: timestamp("created_at").defaultNow().notNull(),

  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});