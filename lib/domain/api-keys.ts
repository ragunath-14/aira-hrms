import { createHash, randomBytes } from "crypto";
import { isIP } from "net";

import { and, eq, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/db";
import { apiKeys, tenants } from "@/db/schema";
import type { ApiScope } from "@/lib/config/api-scopes";
import { clientKey, usedFor, withinLimitFor } from "@/lib/domain/public-limit";

export const KEY_PREFIX = "aira_";
export const MAX_ACTIVE_KEYS = 10;
export const MAX_ALLOWED_IPS = 10;

// A caller who sends this many wrong keys in ten minutes is refused for the
// rest of the window, so guessing is not worth trying.
const FAILURE_LIMIT = 30;
const FAILURE_WINDOW_MS = 10 * 60_000;

const hashKey = (key: string) => createHash("sha256").update(key).digest("hex");

// A new random key (256 bits). That is long and random enough that a plain
// SHA-256 hash is safe to store; the key itself is shown once and never kept.
export function generateApiKey() {
  const key = `${KEY_PREFIX}${randomBytes(32).toString("base64url")}`;

  return { key, prefix: key.slice(0, 12), hash: hashKey(key) };
}

// The key from the Authorization header (or X-API-Key). Never from the address:
// addresses end up in logs and browser history.
export function readKey(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  const bearer = /^Bearer\s+(\S+)$/i.exec(header)?.[1];

  return bearer ?? request.headers.get("x-api-key")?.trim() ?? null;
}

// The addresses a key may be limited to, cleaned: real IPv4 or IPv6 only.
export function cleanIpList(list: unknown): { ok: true; ips: string[] } | { ok: false; bad: string } {
  const ips: string[] = [];

  for (const item of Array.isArray(list) ? list : []) {
    const ip = String(item).trim();

    if (!ip) continue;
    if (isIP(ip) === 0) return { ok: false, bad: ip };
    if (!ips.includes(ip)) ips.push(ip);
  }

  return { ok: true, ips: ips.slice(0, MAX_ALLOWED_IPS) };
}

// API answers carry no CORS headers: the key belongs on the company's server,
// never in a visitor's browser.
export const apiJson = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

const reject = (status: number, error: string) => ({
  ok: false as const,
  response: apiJson({ error }, status),
});

// A key sent over plain http can be read by anyone on the path, so a live
// server refuses it. (Render and other hosts say which scheme the visitor used.)
function plainHttp(request: Request) {
  if (process.env.NODE_ENV !== "production") return false;

  // Running on your own computer (a local test) has no https to ask for.
  const host = (request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "")
    .replace(/:\d+$/, "")
    .toLowerCase();

  if (["localhost", "127.0.0.1", "[::1]", "::1", "0.0.0.0"].includes(host)) return false;

  return request.headers.get("x-forwarded-proto") === "http";
}

// Who is calling: the company that owns the key. Refuses unknown, revoked,
// expired, wrong-address, under-scoped and over-limit callers with the response
// to send back.
export async function authenticateApiKey(request: Request, scope: ApiScope) {
  if (plainHttp(request)) return reject(400, "Use https:// for the API. Keys sent over plain http are not accepted.");

  const caller = clientKey(request);

  if ((await usedFor("api-key-fail", caller, FAILURE_WINDOW_MS)) >= FAILURE_LIMIT) {
    return reject(429, "Too many failed attempts. Try again later.");
  }

  const fail = async (status: number, error: string) => {
    await withinLimitFor("api-key-fail", caller, FAILURE_LIMIT, FAILURE_WINDOW_MS);
    return reject(status, error);
  };

  const key = readKey(request);

  if (!key || !key.startsWith(KEY_PREFIX) || key.length > 200) {
    return fail(401, "Send your API key as: Authorization: Bearer <key>");
  }

  const [row] = await db
    .select({
      id: apiKeys.id,
      scopes: apiKeys.scopes,
      allowedIps: apiKeys.allowedIps,
      expiresAt: apiKeys.expiresAt,
      lastUsedAt: apiKeys.lastUsedAt,
      tenant: tenants,
    })
    .from(apiKeys)
    .innerJoin(tenants, eq(tenants.id, apiKeys.tenantId))
    .where(and(eq(apiKeys.keyHash, hashKey(key)), isNull(apiKeys.revokedAt)))
    .limit(1);

  // Unknown, revoked, expired and suspended all look the same from outside.
  if (
    !row ||
    row.tenant.accessStatus !== "approved" ||
    (row.expiresAt && row.expiresAt.getTime() <= Date.now())
  ) {
    return fail(401, "Invalid, expired or revoked API key");
  }

  // A key limited to the company's server is useless to anyone who copies it.
  if (row.allowedIps.length > 0 && !row.allowedIps.includes(caller)) {
    return fail(403, "This API key cannot be used from this address.");
  }

  if (!row.scopes.includes(scope)) {
    return reject(403, `This API key is not allowed to do that. It needs the "${scope}" permission.`);
  }

  if (!(await withinLimitFor("api-key", row.id, 300, 60_000))) {
    return reject(429, "Too many requests. Please slow down.");
  }

  // Record use at most once a minute.
  if (!row.lastUsedAt || Date.now() - row.lastUsedAt.getTime() > 60_000) {
    void db.update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, row.id)).catch(() => {});
  }

  return { ok: true as const, tenant: row.tenant, keyId: row.id };
}
