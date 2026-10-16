import { listPublishedJobs } from "@/lib/domain/careers";
import { apiJson, authenticateApiKey } from "@/lib/domain/api-keys";
import { isUuid } from "@/lib/validation/ids";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Ctx) {
  try {
    const auth = await authenticateApiKey(request, "jobs:read");
    if (!auth.ok) return auth.response;

    const { id } = await params;
    if (!isUuid(id)) return apiJson({ error: "Invalid job id" }, 400);

    const [job] = await listPublishedJobs(auth.tenant.id, id);
    if (!job) return apiJson({ error: "Job not found" }, 404);

    return apiJson({ job });
  } catch (error) {
    console.error("API job:", error);
    return apiJson({ error: "Could not load the job" }, 500);
  }
}
