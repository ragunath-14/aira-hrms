CREATE TABLE "candidate_resumes" (
	"candidate_id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"data" "bytea" NOT NULL
);
--> statement-breakpoint
ALTER TABLE "candidates" ADD COLUMN "source" text DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE "candidates" ADD COLUMN "cover_note" text;--> statement-breakpoint
ALTER TABLE "candidates" ADD COLUMN "resume_name" text;--> statement-breakpoint
ALTER TABLE "candidates" ADD COLUMN "resume_mime" text;--> statement-breakpoint
ALTER TABLE "candidates" ADD COLUMN "resume_size" integer;--> statement-breakpoint
ALTER TABLE "candidates" ADD COLUMN "score" integer;--> statement-breakpoint
ALTER TABLE "job_openings" ADD COLUMN "published" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "candidate_resumes" ADD CONSTRAINT "candidate_resumes_candidate_id_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_resumes" ADD CONSTRAINT "candidate_resumes_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "candidate_resumes_tenant_idx" ON "candidate_resumes" USING btree ("tenant_id");