CREATE TABLE "document_files" (
	"document_id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"data" bytea NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "plan" text DEFAULT 'starter' NOT NULL;--> statement-breakpoint
-- Companies that exist today keep working with no limits; new companies start on "starter".
UPDATE "tenants" SET "plan" = 'enterprise';--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "plan_employee_limit" integer;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "plan_storage_mb" integer;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "plan_expires_at" timestamp;--> statement-breakpoint
ALTER TABLE "employee_documents" ADD COLUMN "kind" text DEFAULT 'link' NOT NULL;--> statement-breakpoint
ALTER TABLE "employee_documents" ADD COLUMN "file_name" text;--> statement-breakpoint
ALTER TABLE "employee_documents" ADD COLUMN "mime_type" text;--> statement-breakpoint
ALTER TABLE "employee_documents" ADD COLUMN "size_bytes" integer;--> statement-breakpoint
ALTER TABLE "employee_documents" ADD COLUMN "visible_to_employee" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "employee_documents" ADD COLUMN "uploaded_by" text;--> statement-breakpoint
ALTER TABLE "document_files" ADD CONSTRAINT "document_files_document_id_employee_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."employee_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_files" ADD CONSTRAINT "document_files_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "document_files_tenant_id_idx" ON "document_files" USING btree ("tenant_id");