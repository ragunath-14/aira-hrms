import { createHmac, randomBytes, randomUUID } from "crypto";
import http from "http";
import https from "https";

import { and, asc, eq, lte } from "drizzle-orm";

import { db } from "@/db";
import { webhookDeliveries, webhookEndpoints } from "@/db/schema";
import { resolveWebhookTarget } from "@/lib/domain/safe-url";

// AIRA tells a company's own system about events (a new application, a change
// of stage) by calling an address the company chose. Every call is signed, so
// the receiver can tell it came from AIRA, and is retried when the receiver is
// down.

export const WEBHOOK_EVENTS = ["application.created", "application.stage_changed", "ping"] as const;
export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

const TIMEOUT_MS = 5_000;
const MAX_ATTEMPTS = 6;
// Wait before retry 1, 2, 3...: 1 min, 5 min, 30 min, 2 h, 6 h.
const BACKOFF_MINUTES = [1, 5, 30, 120, 360];
// A receiver that fails this many times in a row is switched off.
const DISABLE_AFTER = 20;

export const newWebhookSecret = () => `whsec_${randomBytes(24).toString("base64url")}`;

// The signature header: the time, and an HMAC of "time.body" with the secret.
// Receivers recompute it and reject calls whose time is more than a few
// minutes old, so a captured call cannot be replayed later.
export function sign(secret: string, body: string, at = Math.floor(Date.now() / 1000)) {
  const mac = createHmac("sha256", secret).update(`${at}.${body}`).digest("hex");

  return `t=${at},v1=${mac}`;
}

type SendResult = { ok: boolean; status: number | null; error: string | null };

// One signed POST. Pinned to the address that was checked, no redirects
// followed, short timeout, and the answer's body is thrown away.
async function send(url: string, secret: string, event: string, deliveryId: string, body: string): Promise<SendResult> {
  const target = await resolveWebhookTarget(url);

  if (!target.ok) return { ok: false, status: null, error: target.error };

  const lib = target.url.protocol === "https:" ? https : http;

  return new Promise<SendResult>((resolve) => {
    const request = lib.request(
      {
        hostname: target.url.hostname.replace(/^\[|\]$/g, ""),
        port: target.url.port || (target.url.protocol === "https:" ? 443 : 80),
        path: `${target.url.pathname}${target.url.search}`,
        method: "POST",
        timeout: TIMEOUT_MS,
        servername: target.url.hostname,
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
          "User-Agent": "AIRA-HRMS-Webhooks/1",
          "X-AIRA-Event": event,
          "X-AIRA-Delivery": deliveryId,
          "X-AIRA-Signature": sign(secret, body),
        },
        lookup: (_host, options, callback) => {
          const entry = { address: target.address, family: target.family };

          if (typeof options === "object" && options?.all) {
            (callback as unknown as (e: null, a: typeof entry[]) => void)(null, [entry]);
          } else {
            callback(null, entry.address, entry.family);
          }
        },
      },
      (response) => {
        const status = response.statusCode ?? 0;

        response.resume();
        response.on("end", () =>
          resolve(
            status >= 200 && status < 300
              ? { ok: true, status, error: null }
              : { ok: false, status, error: `The receiver answered ${status}` },
          ),
        );
      },
    );

    request.on("timeout", () => request.destroy(new Error("The receiver took too long to answer")));
    request.on("error", (error) => resolve({ ok: false, status: null, error: error.message.slice(0, 200) }));
    request.end(body);
  });
}

// Queues an event for the company's endpoint (if it has one switched on) and
// sends it straight away. Failures are retried later by deliverDue.
export async function queueWebhook(tenantId: string, event: WebhookEvent, data: Record<string, unknown>) {
  try {
    const [endpoint] = await db
      .select({ enabled: webhookEndpoints.enabled })
      .from(webhookEndpoints)
      .where(eq(webhookEndpoints.tenantId, tenantId))
      .limit(1);

    if (!endpoint?.enabled) return;

    const id = randomUUID();

    await db.insert(webhookDeliveries).values({
      id,
      tenantId,
      event,
      payload: { id, type: event, createdAt: new Date().toISOString(), data },
      // This server's clock, not the database's, so "due now" means now.
      nextAttemptAt: new Date(),
    });

    void deliverDue(tenantId).catch((error) => console.error("[webhooks] delivery run failed:", error));
  } catch (error) {
    // Telling the company's system must never break the action that caused it.
    console.error("[webhooks] could not queue", event, error instanceof Error ? error.message : error);
  }
}

// Sends everything that is due (for one company, or all when no id is given).
// Each message is claimed first, so two servers never send it twice.
export async function deliverDue(tenantId?: string) {
  const due = await db
    .select({ id: webhookDeliveries.id })
    .from(webhookDeliveries)
    .where(
      and(
        eq(webhookDeliveries.status, "pending"),
        lte(webhookDeliveries.nextAttemptAt, new Date()),
        ...(tenantId ? [eq(webhookDeliveries.tenantId, tenantId)] : []),
      ),
    )
    .orderBy(asc(webhookDeliveries.createdAt))
    .limit(20);

  let sent = 0;

  for (const { id } of due) {
    // Claim it: push its next attempt out, only if nobody else has.
    const [claimed] = await db
      .update(webhookDeliveries)
      .set({ nextAttemptAt: new Date(Date.now() + 2 * 60_000) })
      .where(
        and(
          eq(webhookDeliveries.id, id),
          eq(webhookDeliveries.status, "pending"),
          lte(webhookDeliveries.nextAttemptAt, new Date()),
        ),
      )
      .returning();

    if (!claimed) continue;

    const [endpoint] = await db
      .select()
      .from(webhookEndpoints)
      .where(eq(webhookEndpoints.tenantId, claimed.tenantId))
      .limit(1);

    if (!endpoint?.enabled) {
      await db
        .update(webhookDeliveries)
        .set({ status: "failed", lastError: "The webhook is switched off or removed" })
        .where(eq(webhookDeliveries.id, id));
      continue;
    }

    const result = await send(endpoint.url, endpoint.secret, claimed.event, id, JSON.stringify(claimed.payload));
    const attempts = claimed.attempts + 1;

    if (result.ok) {
      await db
        .update(webhookDeliveries)
        .set({ status: "delivered", attempts, responseStatus: result.status, lastError: null, deliveredAt: new Date() })
        .where(eq(webhookDeliveries.id, id));
      await db.update(webhookEndpoints).set({ consecutiveFailures: 0 }).where(eq(webhookEndpoints.id, endpoint.id));
      sent++;
      continue;
    }

    const failures = endpoint.consecutiveFailures + 1;
    const giveUp = attempts >= MAX_ATTEMPTS;

    await db
      .update(webhookDeliveries)
      .set({
        status: giveUp ? "failed" : "pending",
        attempts,
        responseStatus: result.status,
        lastError: result.error,
        nextAttemptAt: new Date(Date.now() + (BACKOFF_MINUTES[attempts - 1] ?? 360) * 60_000),
      })
      .where(eq(webhookDeliveries.id, id));

    await db
      .update(webhookEndpoints)
      .set({ consecutiveFailures: failures, enabled: failures < DISABLE_AFTER })
      .where(eq(webhookEndpoints.id, endpoint.id));
  }

  return { due: due.length, sent };
}

// A test call from the settings screen: sent now, recorded, never retried.
export async function sendTestWebhook(tenantId: string) {
  const [endpoint] = await db.select().from(webhookEndpoints).where(eq(webhookEndpoints.tenantId, tenantId)).limit(1);

  if (!endpoint) return null;

  const id = randomUUID();
  const payload = {
    id,
    type: "ping",
    createdAt: new Date().toISOString(),
    data: { message: "This is a test from AIRA HRMS." },
  };
  const result = await send(endpoint.url, endpoint.secret, "ping", id, JSON.stringify(payload));

  await db.insert(webhookDeliveries).values({
    id,
    tenantId,
    event: "ping",
    payload,
    status: result.ok ? "delivered" : "failed",
    attempts: 1,
    responseStatus: result.status,
    lastError: result.error,
    deliveredAt: result.ok ? new Date() : null,
  });

  return result;
}
