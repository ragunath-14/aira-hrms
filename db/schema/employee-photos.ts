import { pgTable, uuid, text, timestamp, index } from "drizzle-orm/pg-core";

import { tenants } from "./tenants";
import { employees } from "./employees";
import { bytea } from "./employee-documents";

// One profile photo per employee. The picture is downsized in the browser
// before upload, so rows stay small. Kept apart from `employees` so the many
// queries that read employees never pull image bytes.
export const employeePhotos = pgTable("employee_photos", {
  employeeId: uuid("employee_id")
    .primaryKey()
    .references(() => employees.id, { onDelete: "cascade" }),

  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),

  mimeType: text("mime_type").notNull(),

  data: bytea("data").notNull(),

  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("employee_photos_tenant_id_idx").on(table.tenantId),
]);
