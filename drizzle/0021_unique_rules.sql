CREATE UNIQUE INDEX "departments_tenant_name_uidx" ON "departments" USING btree ("tenant_id",lower(trim("name")));--> statement-breakpoint
CREATE UNIQUE INDEX "designations_tenant_name_uidx" ON "designations" USING btree ("tenant_id",lower(trim("name")));--> statement-breakpoint
CREATE UNIQUE INDEX "employees_tenant_code_uidx" ON "employees" USING btree ("tenant_id",lower("employee_code"));--> statement-breakpoint
CREATE UNIQUE INDEX "employees_tenant_email_uidx" ON "employees" USING btree ("tenant_id",lower("email"));--> statement-breakpoint
CREATE UNIQUE INDEX "payroll_records_employee_period_uidx" ON "payroll_records" USING btree ("tenant_id","employee_id","payroll_period");--> statement-breakpoint
CREATE UNIQUE INDEX "payslips_record_uidx" ON "payslips" USING btree ("payroll_record_id");