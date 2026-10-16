import { and, count, desc, eq, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/db";
import { apiKeys } from "@/db/schema";
import { requireRole } from "@/lib/auth/authorization";
import { API_SCOPE_IDS, KEY_EXPIRY_CHOICES } from "@/lib/config/api-scopes";
import { MAX_ACTIVE_KEYS, cleanIpList, generateApiKey } from "@/lib/domain/api-keys";
import { logAudit } from "@/lib/domain/audit";
import { zodMessage } from "@/lib/format/error-text";

const createSchema = z
  .object({
    name: z.string().trim().min(2, "Give the key a name, such as Company website").max(60),
    scopes: z
      .array(z.string())
      .min(1, "Choose at least one permission")
      .refine((list) => list.every((s) => API_SCOPE_IDS.includes(s)), "Unknown permission"),
    // null = until revoked
    expiresInDays: z
      .number()
      .nullable()
      .refine((d) => d === null || (KEY_EXPIRY_CHOICES as readonly number[]).includes(d), "Choose an expiry from the list"),
    // Optional: the server addresses the key may be used from.
    allowedIps: z.array(z.string()).max(10, "At most 10 addresses").default([]),
  })
  .strict();

const columns = {
  id: apiKeys.id,
  name: apiKeys.name,
  prefix: apiKeys.prefix,
  scopes: apiKeys.scopes,
  allowedIps: apiKeys.allowedIps,
  expiresAt: apiKeys.expiresAt,
  createdAt: apiKeys.createdAt,
  lastUsedAt: apiKeys.lastUsedAt,
};

// The company's API keys (never the keys themselves: only a hash is stored).
export async function GET(request: Request) {
  try {
    const auth = await requireRole(request, ["owner", "admin"]);

    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const keys = await db
      .select(columns)
      .from(apiKeys)
      .where(and(eq(apiKeys.tenantId, auth.tenant.id), isNull(apiKeys.revokedAt)))
      .orderBy(desc(apiKeys.createdAt));

    return NextResponse.json({ keys, max: MAX_ACTIVE_KEYS });
  } catch (error) {
    console.error("API keys fetch:", error);
    return NextResponse.json({ error: "Failed to load the API keys" }, { status: 500 });
  }
}

// Creates a key. The full key is in this answer only; it cannot be shown again.
export async function POST(request: Request) {
  try {
    const auth = await requireRole(request, ["owner", "admin"]);

    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const parsed = createSchema.safeParse(await request.json());

    if (!parsed.success) {
      return NextResponse.json({ error: zodMessage(parsed.error) }, { status: 400 });
    }

    const ips = cleanIpList(parsed.data.allowedIps);

    if (!ips.ok) {
      return NextResponse.json({ error: `"${ips.bad}" is not a valid IP address` }, { status: 400 });
    }

    const [{ active }] = await db
      .select({ active: count() })
      .from(apiKeys)
      .where(and(eq(apiKeys.tenantId, auth.tenant.id), isNull(apiKeys.revokedAt)));

    if (active >= MAX_ACTIVE_KEYS) {
      return NextResponse.json(
        { error: `You can have ${MAX_ACTIVE_KEYS} active keys. Revoke one you no longer use first.` },
        { status: 409 },
      );
    }

    const { key, prefix, hash } = generateApiKey();

    const [created] = await db
      .insert(apiKeys)
      .values({
        tenantId: auth.tenant.id,
        name: parsed.data.name,
        prefix,
        keyHash: hash,
        scopes: [...new Set(parsed.data.scopes)],
        allowedIps: ips.ips,
        expiresAt: parsed.data.expiresInDays
          ? new Date(Date.now() + parsed.data.expiresInDays * 24 * 60 * 60 * 1000)
          : null,
        createdBy: auth.user.id,
      })
      .returning(columns);

    await logAudit({
      tenantId: auth.tenant.id,
      userId: auth.user.id,
      action: "api_key_created",
      entity: "api_key",
      entityId: created.id,
    });

    return NextResponse.json({ ...created, key }, { status: 201 });
  } catch (error) {
    console.error("API key create:", error);
    return NextResponse.json({ error: "Failed to create the API key" }, { status: 500 });
  }
}
