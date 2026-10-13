ALTER TABLE "attendance" ADD COLUMN "work_mode" text DEFAULT 'office' NOT NULL;--> statement-breakpoint
ALTER TABLE "attendance" ADD COLUMN "break_type" text;--> statement-breakpoint
ALTER TABLE "attendance" ADD COLUMN "break_until" timestamp;