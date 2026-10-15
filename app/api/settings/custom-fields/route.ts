import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/db";
import { tenants } from "@/db/schema/tenants";
import { invalidateTenantContextCache, requireRole } from "@/lib/auth/authorization";
import { MAX_CUSTOM_FIELDS, resolveCustomFields } from "@/lib/config/custom-fields";
import { logAudit } from "@/lib/domain/audit";
import { zodMessage } from "@/lib/format/error-text";

const schema = z
  .object({
    fields: z
      .array(
        z
          .object({
            id: z.string().regex(/^[a-z][a-z0-9_]{0,29}$/, "A field key is lower-case letters, digits and underscores"),
            label: z.string().trim().min(1, "Every field needs a name").max(40, "A field name is at most 40 characters"),
            type: z.enum(["text", "number", "date"]),
          })
          .strict(),
      )
      .max(MAX_CUSTOM_FIELDS, `At most ${MAX_CUSTOM_FIELDS} custom fields`),
  })
  .strict()
  .refine((d) => new Set(d.fields.map((f) => f.id)).size === d.fields.length, "Two fields share a key")
  .refine(
    (d) => new Set(d.fields.map((f) => f.label.toLowerCase())).size === d.fields.length,
    "Two fields have the same name",
  );

export async function GET(request: Request) {
  const auth = await requireRole(request, ["owner", "admin", "hr"]);

  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  return NextResponse.json({ fields: resolveCustomFields(auth.tenant.settings) });
}

// Which extra fields the company keeps on employees. Owner and admin only.
export async function PUT(request: Request) {
  try {
    const auth = await requireRole(request, ["owner", "admin"]);

    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const parsed = schema.safeParse(await request.json().catch(() => null));

    if (!parsed.success) {
      return NextResponse.json({ error: zodMessage(parsed.error) }, { status: 400 });
    }

    const [updated] = await db
      .update(tenants)
      .set({
        settings: { ...(auth.tenant.settings ?? {}), customFields: parsed.data.fields },
        updatedAt: new Date(),
      })
      .where(eq(tenants.id, auth.tenant.id))
      .returning();

    await logAudit({
      tenantId: auth.tenant.id,
      userId: auth.user.id,
      action: "custom_fields_updated",
      entity: "tenant",
      entityId: auth.tenant.id,
    });

    invalidateTenantContextCache();

    return NextResponse.json({ fields: resolveCustomFields(updated.settings) });
  } catch (error) {
    console.error("PUT custom fields error:", error);

    return NextResponse.json({ error: "Failed to save custom fields" }, { status: 500 });
  }
}
