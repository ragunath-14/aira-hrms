import { asc, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/db";
import { customRoles } from "@/db/schema";
import { requireRole } from "@/lib/auth/authorization";
import { ACTIONS, BASE_ROLES, MODULES, sanitizePermissions } from "@/lib/auth/custom-roles";
import { customRoleSchema } from "@/lib/validation/schemas";
import { logAudit } from "@/lib/domain/audit";
import { zodMessage } from "@/lib/format/error-text";

// The company's own roles, with how many people have each, and the list of
// areas and actions a role can be built from.
export async function GET(request: Request) {
  try {
    const auth = await requireRole(request, ["owner", "admin", "hr"]);

    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const rows = await db
      .select({
        id: customRoles.id,
        name: customRoles.name,
        baseRole: customRoles.baseRole,
        permissions: customRoles.permissions,
        members: sql<number>`(select count(*)::int from memberships m where m.custom_role_id = ${customRoles.id})`,
      })
      .from(customRoles)
      .where(eq(customRoles.tenantId, auth.tenant.id))
      .orderBy(asc(customRoles.name));

    return NextResponse.json({
      roles: rows.map((r) => ({ ...r, permissions: sanitizePermissions(r.permissions) })),
      modules: MODULES,
      actions: ACTIONS,
      baseRoles: BASE_ROLES,
    });
  } catch (error) {
    console.error("GET custom roles error:", error);

    return NextResponse.json({ error: "Failed to load roles" }, { status: 500 });
  }
}

// Owner and admin create roles. A role can only take access away from its base
// role, never add to it.
export async function POST(request: Request) {
  try {
    const auth = await requireRole(request, ["owner", "admin"]);

    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const parsed = customRoleSchema.safeParse(await request.json().catch(() => null));

    if (!parsed.success) {
      return NextResponse.json({ error: zodMessage(parsed.error) }, { status: 400 });
    }

    const [duplicate] = await db
      .select({ id: customRoles.id })
      .from(customRoles)
      .where(
        sql`${customRoles.tenantId} = ${auth.tenant.id} and lower(trim(${customRoles.name})) = lower(trim(${parsed.data.name}))`,
      )
      .limit(1);

    if (duplicate) {
      return NextResponse.json({ error: "A role with this name already exists" }, { status: 409 });
    }

    const [created] = await db
      .insert(customRoles)
      .values({
        tenantId: auth.tenant.id,
        name: parsed.data.name,
        baseRole: parsed.data.baseRole,
        permissions: sanitizePermissions(parsed.data.permissions) as Record<string, string[]>,
      })
      .returning();

    await logAudit({
      tenantId: auth.tenant.id,
      userId: auth.user.id,
      action: "custom_role_created",
      entity: "custom_role",
      entityId: created.id,
    });

    return NextResponse.json({ ...created, members: 0 }, { status: 201 });
  } catch (error) {
    console.error("POST custom role error:", error);

    return NextResponse.json({ error: "Failed to create the role" }, { status: 500 });
  }
}
