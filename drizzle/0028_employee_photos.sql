CREATE TABLE "employee_photos" (
	"employee_id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"mime_type" text NOT NULL,
	"data" bytea NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "employee_photos" ADD CONSTRAINT "employee_photos_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_photos" ADD CONSTRAINT "employee_photos_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "employee_photos_tenant_id_idx" ON "employee_photos" USING btree ("tenant_id");