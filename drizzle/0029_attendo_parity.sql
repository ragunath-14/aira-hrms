CREATE TABLE "attendance_photos" (
	"attendance_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"tenant_id" uuid NOT NULL,
	"mime_type" text NOT NULL,
	"data" bytea NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "attendance_photos_attendance_id_kind_pk" PRIMARY KEY("attendance_id","kind")
);
--> statement-breakpoint
CREATE TABLE "loan_repayments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"loan_id" uuid NOT NULL,
	"payroll_record_id" uuid NOT NULL,
	"payroll_period" text NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "loans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"kind" text DEFAULT 'advance' NOT NULL,
	"principal" numeric(12, 2) NOT NULL,
	"installments" integer NOT NULL,
	"installment_amount" numeric(12, 2) NOT NULL,
	"start_period" text NOT NULL,
	"balance" numeric(12, 2) NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"note" text,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payroll_adjustments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"payroll_period" text NOT NULL,
	"kind" text NOT NULL,
	"label" text NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "locations" ADD COLUMN "latitude" numeric(9, 6);--> statement-breakpoint
ALTER TABLE "locations" ADD COLUMN "longitude" numeric(9, 6);--> statement-breakpoint
ALTER TABLE "locations" ADD COLUMN "geofence_radius_m" integer;--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "custom_fields" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "attendance" ADD COLUMN "check_in_lat" numeric(9, 6);--> statement-breakpoint
ALTER TABLE "attendance" ADD COLUMN "check_in_lng" numeric(9, 6);--> statement-breakpoint
ALTER TABLE "attendance" ADD COLUMN "check_in_distance_m" integer;--> statement-breakpoint
ALTER TABLE "attendance" ADD COLUMN "check_out_lat" numeric(9, 6);--> statement-breakpoint
ALTER TABLE "attendance" ADD COLUMN "check_out_lng" numeric(9, 6);--> statement-breakpoint
ALTER TABLE "attendance" ADD COLUMN "check_out_distance_m" integer;--> statement-breakpoint
ALTER TABLE "leave_types" ADD COLUMN "is_paid" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "employee_statutory" ADD COLUMN "bank_name" text;--> statement-breakpoint
ALTER TABLE "employee_statutory" ADD COLUMN "account_number" text;--> statement-breakpoint
ALTER TABLE "employee_statutory" ADD COLUMN "ifsc" text;--> statement-breakpoint
ALTER TABLE "payroll_records" ADD COLUMN "days_in_period" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "payroll_records" ADD COLUMN "paid_days" numeric(5, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "payroll_records" ADD COLUMN "lop_days" numeric(5, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "payroll_records" ADD COLUMN "overtime_hours" numeric(6, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "payroll_records" ADD COLUMN "overtime_pay" numeric(12, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "payroll_records" ADD COLUMN "adjustment_earnings" numeric(12, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "payroll_records" ADD COLUMN "adjustment_deductions" numeric(12, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "payroll_records" ADD COLUMN "loan_deduction" numeric(12, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "payroll_records" ADD COLUMN "lwf_employee" numeric(12, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "payroll_records" ADD COLUMN "lwf_employer" numeric(12, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "salary_components" ADD COLUMN "employee_id" uuid;--> statement-breakpoint
ALTER TABLE "holidays" ADD COLUMN "location_id" uuid;--> statement-breakpoint
ALTER TABLE "attendance_photos" ADD CONSTRAINT "attendance_photos_attendance_id_attendance_id_fk" FOREIGN KEY ("attendance_id") REFERENCES "public"."attendance"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_photos" ADD CONSTRAINT "attendance_photos_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan_repayments" ADD CONSTRAINT "loan_repayments_loan_id_loans_id_fk" FOREIGN KEY ("loan_id") REFERENCES "public"."loans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan_repayments" ADD CONSTRAINT "loan_repayments_payroll_record_id_payroll_records_id_fk" FOREIGN KEY ("payroll_record_id") REFERENCES "public"."payroll_records"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loans" ADD CONSTRAINT "loans_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loans" ADD CONSTRAINT "loans_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_adjustments" ADD CONSTRAINT "payroll_adjustments_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_adjustments" ADD CONSTRAINT "payroll_adjustments_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "attendance_photos_tenant_id_idx" ON "attendance_photos" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "loan_repayments_loan_period_uidx" ON "loan_repayments" USING btree ("loan_id","payroll_period");--> statement-breakpoint
CREATE INDEX "loans_tenant_id_idx" ON "loans" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "loans_employee_id_idx" ON "loans" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "payroll_adjustments_tenant_period_idx" ON "payroll_adjustments" USING btree ("tenant_id","payroll_period");--> statement-breakpoint
CREATE INDEX "payroll_adjustments_employee_idx" ON "payroll_adjustments" USING btree ("employee_id");--> statement-breakpoint
ALTER TABLE "salary_components" ADD CONSTRAINT "salary_components_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "holidays" ADD CONSTRAINT "holidays_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE cascade ON UPDATE no action;