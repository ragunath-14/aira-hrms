import { and, asc, eq, gt, ne } from "drizzle-orm";

import { db } from "@/db";
import { candidates } from "@/db/schema";
import { MAX_RESUME_BYTES, RESUME_TEXT } from "@/lib/config/careers";
import { apiJson, authenticateApiKey } from "@/lib/domain/api-keys";
import { processApplication } from "@/lib/domain/careers-apply";
import { formatSize } from "@/lib/domain/documents";
import { withinLimitFor } from "@/lib/domain/public-limit";
import { CANDIDATE_STAGES } from "@/lib/validation/schemas";
import { isUuid } from "@/lib/validation/ids";

// Base64 grows a file by a third.
const MAX_JSON_BYTES = Math.ceil(MAX_RESUME_BYTES * 1.4) + 64 * 1024;

// Sends an application from the company's own website or software. Either a
// form (multipart, with a "resume" file) or JSON with the resume as base64:
//   { jobId, name, email, phone?, coverNote?, resume: { fileName, contentBase64 } }
export async function POST(request: Request) {
  try {
    const auth = await authenticateApiKey(request, "applications:write");
    if (!auth.ok) return auth.response;

    if (!(await withinLimitFor("api-apply", auth.keyId, 60, 10 * 60_000))) {
      return apiJson({ error: "Too many applications from this key. Please try again later." }, 429);
    }

    const declared = Number(request.headers.get("content-length") ?? 0);

    if (declared > MAX_JSON_BYTES) {
      return apiJson({ error: `The resume is too large. The limit is ${formatSize(MAX_RESUME_BYTES)}.` }, 413);
    }

    let form: FormData;

    if ((request.headers.get("content-type") ?? "").includes("application/json")) {
      let body: Record<string, unknown>;

      try {
        body = await request.json();
      } catch {
        return apiJson({ error: "The body is not valid JSON" }, 400);
      }

      form = new FormData();

      for (const key of ["jobId", "name", "email", "phone", "coverNote"]) {
        if (typeof body[key] === "string") form.set(key, body[key]);
      }

      const resume = body.resume as { fileName?: unknown; contentBase64?: unknown } | undefined;

      if (resume && typeof resume.fileName === "string" && typeof resume.contentBase64 === "string") {
        if (resume.contentBase64.length > MAX_JSON_BYTES) {
          return apiJson({ error: `The resume is too large. The limit is ${formatSize(MAX_RESUME_BYTES)}.` }, 413);
        }

        form.set("resume", new File([Buffer.from(resume.contentBase64, "base64")], resume.fileName));
      }
    } else {
      try {
        form = await request.formData();
      } catch {
        return apiJson({ error: `Send JSON, or a form with a "resume" file (${RESUME_TEXT})` }, 400);
      }
    }

    const result = await processApplication(auth.tenant, form, "api");

    return apiJson(result.body, result.status);
  } catch (error) {
    console.error("API apply:", error);
    return apiJson({ error: "Could not save the application" }, 500);
  }
}

// The applications that came in through the API and the careers page, oldest
// first, so a system can pick up where it left off with ?since=<last createdAt>.
// Resumes, notes and ratings stay inside AIRA. Needs the personal-data scope.
export async function GET(request: Request) {
  try {
    const auth = await authenticateApiKey(request, "applications:read");
    if (!auth.ok) return auth.response;

    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get("jobId");
    const stage = searchParams.get("stage");
    const sinceText = searchParams.get("since");
    const limit = Math.min(Math.max(Number(searchParams.get("limit") ?? 100) || 100, 1), 200);

    if (jobId && !isUuid(jobId)) return apiJson({ error: "Invalid jobId" }, 400);

    if (stage && !(CANDIDATE_STAGES as readonly string[]).includes(stage)) {
      return apiJson({ error: `stage must be one of: ${CANDIDATE_STAGES.join(", ")}` }, 400);
    }

    const since = sinceText ? new Date(sinceText) : null;

    if (since && Number.isNaN(since.getTime())) return apiJson({ error: "since must be a date-time" }, 400);

    const rows = await db
      .select({
        id: candidates.id,
        jobId: candidates.jobId,
        name: candidates.name,
        email: candidates.email,
        phone: candidates.phone,
        stage: candidates.stage,
        source: candidates.source,
        createdAt: candidates.createdAt,
      })
      .from(candidates)
      .where(
        and(
          eq(candidates.tenantId, auth.tenant.id),
          // People the team typed in by hand stay inside AIRA.
          ne(candidates.source, "manual"),
          ...(jobId ? [eq(candidates.jobId, jobId)] : []),
          ...(stage ? [eq(candidates.stage, stage)] : []),
          ...(since ? [gt(candidates.createdAt, since)] : []),
        ),
      )
      .orderBy(asc(candidates.createdAt))
      .limit(limit);

    return apiJson({ applications: rows });
  } catch (error) {
    console.error("API applications:", error);
    return apiJson({ error: "Could not load the applications" }, 500);
  }
}
