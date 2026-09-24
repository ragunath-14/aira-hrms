import {
  pgTable,
  uuid,
  text,
  timestamp,
  index,
} from "drizzle-orm/pg-core";

import { tenants } from "./tenants";
import { employees } from "./employees";

export const performanceGoals = pgTable(
  "performance_goals",
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

    title: text("title").notNull(),

    description: text("description"),

    status: text("status")
      .notNull()
      .default("active"),

    createdAt: timestamp("created_at")
      .defaultNow()
      .notNull(),

    updatedAt: timestamp("updated_at")
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("performance_goals_tenant_id_idx").on(table.tenantId),
    index("performance_goals_employee_id_idx").on(table.employeeId),
  ],
);