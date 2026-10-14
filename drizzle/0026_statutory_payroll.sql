CREATE TABLE "employee_statutory" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"pan" text,
	"uan" text,
	"esi_number" text,
	"pf_applicable" boolean DEFAULT true NOT NULL,
	"esi_applicable" boolean DEFAULT true NOT NULL,
	"pt_applicable" boolean DEFAULT true NOT NULL,
	"tax_regime" text DEFAULT 'new' NOT NULL,
	"declared_deductions" numeric(12, 2) DEFAULT '0' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "payroll_records" ADD COLUMN "pf_wage" numeric(12, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "payroll_records" ADD COLUMN "pf_employee" numeric(12, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "payroll_records" ADD COLUMN "pf_employer" numeric(12, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "payroll_records" ADD COLUMN "esi_wage" numeric(12, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "payroll_records" ADD COLUMN "esi_employee" numeric(12, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "payroll_records" ADD COLUMN "esi_employer" numeric(12, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "payroll_records" ADD COLUMN "professional_tax" numeric(12, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "payroll_records" ADD COLUMN "tds" numeric(12, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "employee_statutory" ADD CONSTRAINT "employee_statutory_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_statutory" ADD CONSTRAINT "employee_statutory_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "employee_statutory_tenant_id_idx" ON "employee_statutory" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "employee_statutory_employee_uidx" ON "employee_statutory" USING btree ("tenant_id","employee_id");