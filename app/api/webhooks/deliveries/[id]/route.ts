import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/db";
import { webhookDeliveries, webhookEndpoints } from "@/db/schema";
import { requireRole } from "@/lib/auth/authorization";
import { deliverDue } from "@/lib/domain/webhooks";
import { isUuid } from "@/lib/validation/ids";

type Ctx = { params: Promise<{ id: string }> };

// Tries a failed message again now, for example after the receiver was fixed.
export async function POST(request: Request, { params }: Ctx) {
  try {
    const auth = await requireRole(request, ["owner", "admin"]);

    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { id } = await params;

    if (!isUuid(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

    const [endpoint] = await db
      .select({ enabled: webhookEndpoints.enabled })
      .from(webhookEndpoints)
      .where(eq(webhookEndpoints.tenantId, auth.tenant.id))
      .limit(1);

    if (!endpoint) return NextResponse.json({ error: "No webhook is set up" }, { status: 404 });

    const [queued] = await db
      .update(webhookDeliveries)
      .set({ status: "pending", attempts: 0, nextAttemptAt: new Date() })
      .where(and(eq(webhookDeliveries.id, id), eq(webhookDeliveries.tenantId, auth.tenant.id)))
      .returning({ id: webhookDeliveries.id });

    if (!queued) return NextResponse.json({ error: "Message not found" }, { status: 404 });

    await deliverDue(auth.tenant.id);

    const [after] = await db
      .select({ status: webhookDeliveries.status, lastError: webhookDeliveries.lastError })
      .from(webhookDeliveries)
      .where(eq(webhookDeliveries.id, id))
      .limit(1);

    return NextResponse.json(after);
  } catch (error) {
    console.error("Webhook retry:", error);
    return NextResponse.json({ error: "Failed to retry" }, { status: 500 });
  }
}
