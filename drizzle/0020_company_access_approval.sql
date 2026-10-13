ALTER TABLE "tenants" ADD COLUMN "access_status" text DEFAULT 'approved' NOT NULL;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "access_reviewed_at" timestamp;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "access_reviewed_by" uuid;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "access_note" text;