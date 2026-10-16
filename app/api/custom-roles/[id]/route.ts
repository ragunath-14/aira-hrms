import { and, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/db";
import { customRoles, memberships } from "@/db/schema";
import { invalidateTenantContextCache, requireRole } from "@/lib/auth/authorization";
import { sanitizePermissions } from "@/lib/auth/custom-roles";
import { logAudit } from "@/lib/domain/audit";
import { zodMessage } from "@/lib/format/error-text";
import { isUuid } from "@/lib/validation/ids";
import { customRoleSchema } from "@/lib/validation/schemas";

type Ctx = { params: Promise<{ id: string }> };

// Change a role's name, base role or permissions. Everyone who has the role
// is affected straight away.
export async function PATCH(request: Request, { params }: Ctx) {
  try {
    const auth = await requireRole(request, ["owner", "admin"]);

    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { id } = await params;
    if (!isUuid(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

    const parsed = customRoleSchema.safeParse(await request.json().catch(() => null));

    if (!parsed.success) {
      return NextResponse.json({ error: zodMessage(parsed.error) }, { status: 400 });
    }

    const [existing] = await db
      .select({ id: customRoles.id })
      .from(customRoles)
      .where(and(eq(customRoles.id, id), eq(customRoles.tenantId, auth.tenant.id)))
      .limit(1);

    if (!existing) return NextResponse.json({ error: "Role not found" }, { status: 404 });

    const [duplicate] = await db
      .select({ id: customRoles.id })
      .from(customRoles)
      .where(
        sql`${customRoles.tenantId} = ${auth.tenant.id} and ${customRoles.id} <> ${id} and lower(trim(${customRoles.name})) = lower(trim(${parsed.data.name}))`,
      )
      .limit(1);

    if (duplicate) {
      return NextResponse.json({ error: "A role with this name already exists" }, { status: 409 });
    }

    const [updated] = await db
      .update(customRoles)
      .set({
        name: parsed.data.name,
        baseRole: parsed.data.baseRole,
        permissions: sanitizePermissions(parsed.data.permissions) as Record<string, string[]>,
        updatedAt: new Date(),
      })
      .where(eq(customRoles.id, id))
      .returning();

    // People with this role act as its base role, so keep them in step.
    await db
      .update(memberships)
      .set({ role: parsed.data.baseRole })
      .where(and(eq(memberships.customRoleId, id), eq(memberships.tenantId, auth.tenant.id)));

    invalidateTenantContextCache();

    await logAudit({
      tenantId: auth.tenant.id,
      userId: auth.user.id,
      action: "custom_role_updated",
      entity: "custom_role",
      entityId: id,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PATCH custom role error:", error);

    return NextResponse.json({ error: "Failed to update the role" }, { status: 500 });
  }
}

// A role in use cannot be deleted: its people would silently get their base
// role's full access. Give them another role first.
export async function DELETE(request: Request, { params }: Ctx) {
  try {
    const auth = await requireRole(request, ["owner", "admin"]);

    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { id } = await params;
    if (!isUuid(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

    const [role] = await db
      .select({ id: customRoles.id })
      .from(customRoles)
      .where(and(eq(customRoles.id, id), eq(customRoles.tenantId, auth.tenant.id)))
      .limit(1);

    if (!role) return NextResponse.json({ error: "Role not found" }, { status: 404 });

    const [using] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(memberships)
      .where(eq(memberships.customRoleId, id));

    if ((using?.n ?? 0) > 0) {
      return NextResponse.json(
        {
          error: `${using.n} ${using.n === 1 ? "person has" : "people have"} this role. Give them another role first, so they do not end up with more access than intended.`,
        },
        { status: 409 },
      );
    }

    await db.delete(customRoles).where(eq(customRoles.id, id));

    await logAudit({
      tenantId: auth.tenant.id,
      userId: auth.user.id,
      action: "custom_role_deleted",
      entity: "custom_role",
      entityId: id,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE custom role error:", error);

    return NextResponse.json({ error: "Failed to delete the role" }, { status: 500 });
  }
}
