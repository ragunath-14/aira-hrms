import {
  pgTable,
  uuid,
  text,
  timestamp,
  index,
  uniqueIndex,
  jsonb,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

import { tenants } from "./tenants";
import { departments, designations, locations } from "./organization";
import { users } from "./users";

export const employees = pgTable("employees", {
  id: uuid("id").defaultRandom().primaryKey(),

  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, {
      onDelete: "cascade",
    }),

  employeeCode: text("employee_code").notNull(),

  firstName: text("first_name").notNull(),

  lastName: text("last_name"),

  email: text("email").notNull(),

  phone: text("phone"),

  dateOfJoining: timestamp("date_of_joining"),

  // YYYY-MM-DD, used for birthday reminders.
  dateOfBirth: text("date_of_birth"),

  departmentId: uuid("department_id").references(
    () => departments.id,
    {
      onDelete: "set null",
    },
  ),

  designationId: uuid("designation_id").references(
    () => designations.id,
    {
      onDelete: "set null",
    },
  ),

  locationId: uuid("location_id").references(
    () => locations.id,
    {
      onDelete: "set null",
    },
  ),

  managerId: uuid("manager_id"),

  userId: uuid("user_id").references(
    () => users.id,
    {
      onDelete: "set null",
    },
  ),

  status: text("status").notNull().default("active"),

  // Values for the company's own extra employee fields (Settings -> Custom
  // fields), keyed by field id.
  customFields: jsonb("custom_fields")
    .$type<Record<string, string>>()
    .notNull()
    .default({}),

  createdAt: timestamp("created_at")
    .defaultNow()
    .notNull(),

  updatedAt: timestamp("updated_at")
    .defaultNow()
    .notNull(),
}, (table) => [
  index("employees_tenant_id_idx").on(table.tenantId),
  index("employees_user_id_idx").on(table.userId),
  index("employees_manager_id_idx").on(table.managerId),
  index("employees_department_id_idx").on(table.departmentId),
  uniqueIndex("employees_tenant_code_uidx").on(table.tenantId, sql`lower(${table.employeeCode})`),
  uniqueIndex("employees_tenant_email_uidx").on(table.tenantId, sql`lower(${table.email})`),
]);