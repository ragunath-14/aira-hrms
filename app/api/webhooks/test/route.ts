import { NextResponse } from "next/server";

import { requireRole } from "@/lib/auth/authorization";
import { withinLimitFor } from "@/lib/domain/public-limit";
import { sendTestWebhook } from "@/lib/domain/webhooks";

// Sends a test message to the company's webhook so they can see it arrive.
export async function POST(request: Request) {
  try {
    const auth = await requireRole(request, ["owner", "admin"]);

    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    // The server makes the call, so do not let this become a way to hammer
    // someone else's address.
    if (!(await withinLimitFor("webhook-test", auth.tenant.id, 10, 10 * 60_000))) {
      return NextResponse.json({ error: "Too many tests. Try again in a few minutes." }, { status: 429 });
    }

    const result = await sendTestWebhook(auth.tenant.id);

    if (!result) return NextResponse.json({ error: "No webhook is set up" }, { status: 404 });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Webhook test:", error);
    return NextResponse.json({ error: "Failed to send the test" }, { status: 500 });
  }
}
