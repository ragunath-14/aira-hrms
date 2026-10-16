import { listPublishedJobs } from "@/lib/domain/careers";
import { apiJson, authenticateApiKey } from "@/lib/domain/api-keys";

// The company's published, open jobs, for its own website or software.
export async function GET(request: Request) {
  try {
    const auth = await authenticateApiKey(request, "jobs:read");
    if (!auth.ok) return auth.response;

    return apiJson({ jobs: await listPublishedJobs(auth.tenant.id) });
  } catch (error) {
    console.error("API jobs:", error);
    return apiJson({ error: "Could not load the jobs" }, 500);
  }
}
