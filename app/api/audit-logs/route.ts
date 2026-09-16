import { NextResponse } from "next/server";
import { and, eq, desc } from "drizzle-orm";

import { db } from "@/db";
import { auditLogs } from "@/db/schema/audit-logs";
import { users } from "@/db/schema/users";
import { requireRole } from "@/lib/authorization";

export async function GET(request: Request) {
  try {
    const auth = await requireRole(request, [
      "owner",
      "admin",
    ]);

    if (!auth.authorized) {
      return NextResponse.json(
        { error: auth.error },
        { status: auth.status },
      );
    }

    const { searchParams } = new URL(request.url);
    const entity = searchParams.get("entity");
    const entityId = searchParams.get("entityId");

    const conditions = [
      eq(auditLogs.tenantId, auth.tenant.id),
    ];

    if (entity) {
      conditions.push(eq(auditLogs.entity, entity));
    }

    if (entityId) {
      conditions.push(eq(auditLogs.entityId, entityId));
    }

    const logs = await db
      .select({
        id: auditLogs.id,
        action: auditLogs.action,
        entity: auditLogs.entity,
        entityId: auditLogs.entityId,
        createdAt: auditLogs.createdAt,
        userId: auditLogs.userId,
        userName: users.name,
        userEmail: users.email,
      })
      .from(auditLogs)
      .leftJoin(users, eq(auditLogs.userId, users.id))
      .where(and(...conditions))
      .orderBy(desc(auditLogs.createdAt))
      .limit(200);

    return NextResponse.json(logs);
  } catch (error) {
    console.error("GET audit logs error:", error);

    return NextResponse.json(
      { error: "Failed to fetch audit logs" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireRole(request, [
      "owner",
      "admin",
      "hr",
      "manager",
      "employee",
      "member",
    ]);

    if (!auth.authorized) {
      return NextResponse.json(
        { error: auth.error },
        { status: auth.status },
      );
    }

    const body = await request.json();

    if (!body.action || !body.entity) {
      return NextResponse.json(
        { error: "action and entity are required" },
        { status: 400 },
      );
    }

    const [log] = await db
      .insert(auditLogs)
      .values({
        tenantId: auth.tenant.id,
        userId: auth.user.id,
        action: body.action,
        entity: body.entity,
        entityId: body.entityId ?? null,
      })
      .returning();

    return NextResponse.json(log, { status: 201 });
  } catch (error) {
    console.error("POST audit log error:", error);

    return NextResponse.json(
      { error: "Failed to create audit log" },
      { status: 500 },
    );
  }
}
