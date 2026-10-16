import { and, eq, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/db";
import { apiKeys } from "@/db/schema";
import { requireRole } from "@/lib/auth/authorization";
import { logAudit } from "@/lib/domain/audit";
import { isUuid } from "@/lib/validation/ids";

type Ctx = { params: Promise<{ id: string }> };

// Revokes a key: whatever uses it stops working at once.
export async function DELETE(request: Request, { params }: Ctx) {
  try {
    const auth = await requireRole(request, ["owner", "admin"]);

    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { id } = await params;

    if (!isUuid(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

    const [revoked] = await db
      .update(apiKeys)
      .set({ revokedAt: new Date() })
      .where(and(eq(apiKeys.id, id), eq(apiKeys.tenantId, auth.tenant.id), isNull(apiKeys.revokedAt)))
      .returning({ id: apiKeys.id });

    if (!revoked) return NextResponse.json({ error: "API key not found" }, { status: 404 });

    await logAudit({
      tenantId: auth.tenant.id,
      userId: auth.user.id,
      action: "api_key_revoked",
      entity: "api_key",
      entityId: id,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("API key revoke:", error);
    return NextResponse.json({ error: "Failed to revoke the API key" }, { status: 500 });
  }
}
