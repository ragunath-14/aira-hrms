import {
  pgTable,
  uuid,
  text,
  timestamp,
  index,
  integer,
  boolean,
  customType,
} from "drizzle-orm/pg-core";

import { tenants } from "./tenants";
import { employees } from "./employees";

export const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return "bytea";
  },
});

export const employeeDocuments = pgTable("employee_documents", {
  id: uuid("id").defaultRandom().primaryKey(),

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

  name: text("name").notNull(),

  type: text("type"), // e.g. "resume", "id_proof", "contract"

  // For an uploaded file this is the download path (/api/documents/<id>/file);
  // for a legacy link it is the address itself.
  url: text("url").notNull(),

  // "file" = uploaded here (bytes live in document_files); "link" = an address.
  kind: text("kind").notNull().default("link"),

  fileName: text("file_name"),

  mimeType: text("mime_type"),

  sizeBytes: integer("size_bytes"),

  // When false only HR sees it (letters and notes about the employee).
  visibleToEmployee: boolean("visible_to_employee").notNull().default(true),

  uploadedBy: text("uploaded_by"),

  createdAt: timestamp("created_at")
    .defaultNow()
    .notNull(),

  updatedAt: timestamp("updated_at")
    .defaultNow()
    .notNull(),
}, (table) => [
  index("employee_documents_tenant_id_idx").on(table.tenantId),
  index("employee_documents_employee_id_idx").on(table.employeeId),
]);

// The bytes of an uploaded file, kept apart from employee_documents so listing
// documents never pulls file contents. Deleted with its document.
export const documentFiles = pgTable("document_files", {
  documentId: uuid("document_id")
    .primaryKey()
    .references(() => employeeDocuments.id, { onDelete: "cascade" }),

  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),

  data: bytea("data").notNull(),
}, (table) => [
  index("document_files_tenant_id_idx").on(table.tenantId),
]);
