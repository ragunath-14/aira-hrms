import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { candidateResumes, candidates, jobOpenings, type tenants } from "@/db/schema";
import { MAX_RESUME_BYTES, RESUME_EXTENSIONS, RESUME_TEXT } from "@/lib/config/careers";
import { notifyRecruiters } from "@/lib/domain/careers";
import { logAudit } from "@/lib/domain/audit";
import { detectFileType, formatSize, safeFileName } from "@/lib/domain/documents";
import { scanWithClamav, screenResume } from "@/lib/domain/file-screen";
import { checkCanStore } from "@/lib/domain/plans";
import { withinLimitFor } from "@/lib/domain/public-limit";
import { queueWebhook } from "@/lib/domain/webhooks";
import { zodMessage } from "@/lib/format/error-text";

const applicationSchema = z.object({
  jobId: z.string().uuid("Choose a position"),
  name: z.string().trim().min(2, "Enter your full name").max(120),
  email: z.string().trim().email("Enter a valid email address").max(200),
  phone: z
    .string()
    .trim()
    .regex(/^(\+?[0-9][0-9 ()-]{6,19})?$/, "Phone must be 7 to 20 digits")
    .optional(),
  coverNote: z.string().trim().max(2000, "The cover note is too long (2000 characters at most)").optional(),
});

export type ApplicationResult = { status: number; body: Record<string, unknown> };

// However many addresses the applications come from, one company's inbox
// takes at most this many in an hour.
export const COMPANY_APPLICATIONS_PER_HOUR = 200;

const fail = (status: number, error: string): ApplicationResult => ({ status, body: { error } });

// Where an application came from, kept on the candidate.
export type ApplicationSource = "api";

// Checks one job application (fields plus a resume file) and, when it is good,
// stores it as a candidate in "Applied" with the resume attached, and tells the
// hiring team. Used by the API.
export async function processApplication(
  tenant: typeof tenants.$inferSelect,
  form: FormData,
  source: ApplicationSource,
): Promise<ApplicationResult> {
  const text = (key: string) => {
    const value = form.get(key);
    return typeof value === "string" && value.trim() !== "" ? value : undefined;
  };

  const parsed = applicationSchema.safeParse({
    jobId: text("jobId"),
    name: text("name"),
    email: text("email"),
    phone: text("phone"),
    coverNote: text("coverNote"),
  });

  if (!parsed.success) return fail(400, zodMessage(parsed.error));

  const file = form.get("resume");

  if (!(file instanceof File) || file.size === 0) {
    return fail(400, `Attach your resume (${RESUME_TEXT}).`);
  }

  if (file.size > MAX_RESUME_BYTES) {
    return fail(413, `The resume is too large. The limit is ${formatSize(MAX_RESUME_BYTES)}.`);
  }

  const fileName = safeFileName(file.name);
  const bytes = Buffer.from(await file.arrayBuffer());
  const kind = detectFileType(bytes, fileName);

  if (!kind || !(RESUME_EXTENSIONS as readonly string[]).includes(kind.ext)) {
    return fail(415, `The resume must be a ${RESUME_TEXT} file.`);
  }

  // Scripts, macros and embedded programs have no place in a resume; and a
  // virus scanner, when the host runs one, has its say.
  const unsafe = screenResume(bytes, kind.ext) ?? (await scanWithClamav(bytes));

  if (unsafe) return fail(unsafe.includes("could not be checked") ? 503 : 422, unsafe);

  const [job] = await db
    .select({ id: jobOpenings.id, title: jobOpenings.title })
    .from(jobOpenings)
    .where(
      and(
        eq(jobOpenings.id, parsed.data.jobId),
        eq(jobOpenings.tenantId, tenant.id),
        eq(jobOpenings.published, true),
        eq(jobOpenings.status, "open"),
      ),
    )
    .limit(1);

  if (!job) return fail(404, "This position is no longer open.");

  const [duplicate] = await db
    .select({ id: candidates.id })
    .from(candidates)
    .where(
      and(
        eq(candidates.tenantId, tenant.id),
        eq(candidates.jobId, job.id),
        sql`lower(${candidates.email}) = ${parsed.data.email.toLowerCase()}`,
      ),
    )
    .limit(1);

  if (duplicate) return fail(409, "This person has already applied for this position.");

  // The company's storage plan applies; the applicant just hears "not now".
  if (await checkCanStore(tenant, bytes.length)) {
    return fail(503, "This company is not accepting applications right now.");
  }

  if (!(await withinLimitFor("apply-company", tenant.id, COMPANY_APPLICATIONS_PER_HOUR, 60 * 60_000))) {
    return fail(429, "This company is receiving a lot of applications right now. Please try again later.");
  }

  const created = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(candidates)
      .values({
        tenantId: tenant.id,
        jobId: job.id,
        name: parsed.data.name,
        email: parsed.data.email,
        phone: parsed.data.phone ?? null,
        source,
        coverNote: parsed.data.coverNote ?? null,
        resumeName: fileName,
        resumeMime: kind.mime,
        resumeSize: bytes.length,
      })
      .returning({ id: candidates.id });

    await tx.insert(candidateResumes).values({ candidateId: row.id, tenantId: tenant.id, data: bytes });

    return row;
  });

  await logAudit({
    tenantId: tenant.id,
    userId: null,
    action: "candidate_applied",
    entity: "candidate",
    entityId: created.id,
  });

  void notifyRecruiters({ tenantId: tenant.id, candidateName: parsed.data.name, jobTitle: job.title });

  await queueWebhook(tenant.id, "application.created", {
    applicationId: created.id,
    jobId: job.id,
    jobTitle: job.title,
    name: parsed.data.name,
    email: parsed.data.email,
    phone: parsed.data.phone ?? null,
    stage: "applied",
    source,
  });

  return { status: 201, body: { success: true, applicationId: created.id } };
}
