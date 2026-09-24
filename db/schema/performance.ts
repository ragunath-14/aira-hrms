import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  index,
} from "drizzle-orm/pg-core";

import { tenants } from "./tenants";
import { employees } from "./employees";

export const performanceReviews = pgTable(
  "performance_reviews",
  {
    id: uuid("id")
      .defaultRandom()
      .primaryKey(),

    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, {
        onDelete: "cascade",
      }),

    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employees.id, {
        onDelete: "cascade",
      }),

    reviewPeriod: text("review_period").notNull(),

    rating: integer("rating"),

    comments: text("comments"),

    status: text("status")
      .notNull()
      .default("draft"),

    createdAt: timestamp("created_at")
      .defaultNow()
      .notNull(),

    updatedAt: timestamp("updated_at")
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("performance_reviews_tenant_id_idx").on(table.tenantId),
    index("performance_reviews_employee_id_idx").on(table.employeeId),
  ],
);