import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/db";
import { webhookDeliveries, webhookEndpoints } from "@/db/schema";
import { requireRole } from "@/lib/auth/authorization";
import { logAudit } from "@/lib/domain/audit";
import { resolveWebhookTarget } from "@/lib/domain/safe-url";
import { WEBHOOK_EVENTS, newWebhookSecret } from "@/lib/domain/webhooks";
import { zodMessage } from "@/lib/format/error-text";

const saveSchema = z
  .object({
    url: z.string().trim().min(1, "Enter the address AIRA should call"),
    // A new secret, if the old one may have leaked.
    rotateSecret: z.boolean().default(false),
  })
  .strict();

const toggleSchema = z.object({ enabled: z.boolean() }).strict();

const endpointView = (e: typeof webhookEndpoints.$inferSelect) => ({
  url: e.url,
  enabled: e.enabled,
  consecutiveFailures: e.consecutiveFailures,
  secretHint: e.secret.slice(-4),
  updatedAt: e.updatedAt,
});

async function admin(request: Request) {
  const auth = await requireRole(request, ["owner", "admin"]);

  return auth.authorized
    ? { auth }
    : { response: NextResponse.json({ error: auth.error }, { status: auth.status }) };
}

// The company's webhook and how the last messages went. The secret is never
// returned again after it is first shown.
export async function GET(request: Request) {
  try {
    const gate = await admin(request);
    if (gate.response) return gate.response;
    const { auth } = gate;

    const [endpoint] = await db
      .select()
      .from(webhookEndpoints)
      .where(eq(webhookEndpoints.tenantId, auth.tenant.id))
      .limit(1);

    const deliveries = await db
      .select({
        id: webhookDeliveries.id,
        event: webhookDeliveries.event,
        status: webhookDeliveries.status,
        attempts: webhookDeliveries.attempts,
        responseStatus: webhookDeliveries.responseStatus,
        lastError: webhookDeliveries.lastError,
        createdAt: webhookDeliveries.createdAt,
        deliveredAt: webhookDeliveries.deliveredAt,
        nextAttemptAt: webhookDeliveries.nextAttemptAt,
      })
      .from(webhookDeliveries)
      .where(eq(webhookDeliveries.tenantId, auth.tenant.id))
      .orderBy(desc(webhookDeliveries.createdAt))
      .limit(20);

    return NextResponse.json({
      endpoint: endpoint ? endpointView(endpoint) : null,
      events: WEBHOOK_EVENTS.filter((e) => e !== "ping"),
      deliveries,
    });
  } catch (error) {
    console.error("Webhook fetch:", error);
    return NextResponse.json({ error: "Failed to load the webhook" }, { status: 500 });
  }
}

// Sets the address AIRA calls. A new webhook (or a rotated one) answers with
// its secret, once.
export async function PUT(request: Request) {
  try {
    const gate = await admin(request);
    if (gate.response) return gate.response;
    const { auth } = gate;

    const parsed = saveSchema.safeParse(await request.json());

    if (!parsed.success) {
      return NextResponse.json({ error: zodMessage(parsed.error) }, { status: 400 });
    }

    const target = await resolveWebhookTarget(parsed.data.url);

    if (!target.ok) return NextResponse.json({ error: target.error }, { status: 400 });

    const [existing] = await db
      .select()
      .from(webhookEndpoints)
      .where(eq(webhookEndpoints.tenantId, auth.tenant.id))
      .limit(1);

    const secret = !existing || parsed.data.rotateSecret ? newWebhookSecret() : existing.secret;

    const [saved] = await db
      .insert(webhookEndpoints)
      .values({ tenantId: auth.tenant.id, url: target.url.toString(), secret })
      .onConflictDoUpdate({
        target: webhookEndpoints.tenantId,
        set: { url: target.url.toString(), secret, enabled: true, consecutiveFailures: 0, updatedAt: new Date() },
      })
      .returning();

    await logAudit({
      tenantId: auth.tenant.id,
      userId: auth.user.id,
      action: existing ? "webhook_updated" : "webhook_created",
      entity: "webhook",
      entityId: saved.id,
    });

    return NextResponse.json({
      endpoint: endpointView(saved),
      ...(!existing || parsed.data.rotateSecret ? { secret } : {}),
    });
  } catch (error) {
    console.error("Webhook save:", error);
    return NextResponse.json({ error: "Failed to save the webhook" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const gate = await admin(request);
    if (gate.response) return gate.response;
    const { auth } = gate;

    const parsed = toggleSchema.safeParse(await request.json());

    if (!parsed.success) {
      return NextResponse.json({ error: zodMessage(parsed.error) }, { status: 400 });
    }

    const [saved] = await db
      .update(webhookEndpoints)
      .set({
        enabled: parsed.data.enabled,
        ...(parsed.data.enabled ? { consecutiveFailures: 0 } : {}),
        updatedAt: new Date(),
      })
      .where(eq(webhookEndpoints.tenantId, auth.tenant.id))
      .returning();

    if (!saved) return NextResponse.json({ error: "No webhook is set up" }, { status: 404 });

    return NextResponse.json({ endpoint: endpointView(saved) });
  } catch (error) {
    console.error("Webhook toggle:", error);
    return NextResponse.json({ error: "Failed to update the webhook" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const gate = await admin(request);
    if (gate.response) return gate.response;
    const { auth } = gate;

    const [removed] = await db
      .delete(webhookEndpoints)
      .where(eq(webhookEndpoints.tenantId, auth.tenant.id))
      .returning({ id: webhookEndpoints.id });

    if (!removed) return NextResponse.json({ error: "No webhook is set up" }, { status: 404 });

    // Whatever was waiting to be sent has nowhere to go.
    await db
      .update(webhookDeliveries)
      .set({ status: "failed", lastError: "The webhook was removed" })
      .where(eq(webhookDeliveries.tenantId, auth.tenant.id));

    await logAudit({
      tenantId: auth.tenant.id,
      userId: auth.user.id,
      action: "webhook_removed",
      entity: "webhook",
      entityId: removed.id,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Webhook remove:", error);
    return NextResponse.json({ error: "Failed to remove the webhook" }, { status: 500 });
  }
}
