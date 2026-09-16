import {
  pgTable,
  uuid,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

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

  createdAt: timestamp("created_at")
    .defaultNow()
    .notNull(),

  updatedAt: timestamp("updated_at")
    .defaultNow()
    .notNull(),
});