import { NextResponse } from "next/server";
import { and, desc, eq, gte, ilike, lt, or, sql } from "drizzle-orm";

import { db } from "@/db";
import { auditLogs } from "@/db/schema/audit-logs";
import { users } from "@/db/schema/users";
import { requireRole } from "@/lib/auth/authorization";
import { isRealDate } from "@/lib/validation/schemas";

// Audit entries are written exclusively by server-side logic via
// lib/domain/audit.ts's logAudit() — there is no client-facing write endpoint,
// so the trail can't be forged or polluted by a low-privilege user.

const MAX_PAGE_SIZE = 100;

export async function GET(request: Request) {
  try {
    const auth = await requireRole(request, ["owner", "admin"]);

    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { searchParams } = new URL(request.url);
    const entity = searchParams.get("entity");
    const entityId = searchParams.get("entityId");
    const action = searchParams.get("action");
    const query = searchParams.get("q")?.trim();
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const pageSize = Math.min(
      MAX_PAGE_SIZE,
      Math.max(1, Number(searchParams.get("pageSize")) || 15),
    );

    if ((from && !isRealDate(from)) || (to && !isRealDate(to))) {
      return NextResponse.json(
        { error: "Dates must be real dates written YYYY-MM-DD" },
        { status: 400 },
      );
    }

    const tenantFilter = eq(auditLogs.tenantId, auth.tenant.id);
    const conditions = [tenantFilter];

    if (entity) conditions.push(eq(auditLogs.entity, entity));
    if (entityId) conditions.push(eq(auditLogs.entityId, entityId));
    if (action) conditions.push(eq(auditLogs.action, action));
    if (from) conditions.push(gte(auditLogs.createdAt, new Date(`${from}T00:00:00`)));
    if (to) {
      const end = new Date(`${to}T00:00:00`);
      end.setDate(end.getDate() + 1);
      conditions.push(lt(auditLogs.createdAt, end));
    }
    if (query) {
      const like = `%${query.replace(/[%_\\]/g, "\\$&")}%`;
      conditions.push(
        or(
          ilike(users.name, like),
          ilike(users.email, like),
          ilike(auditLogs.action, like),
          ilike(auditLogs.entity, like),
        )!,
      );
    }

    const where = and(...conditions);

    const [rows, [{ total }], actionRows, entityRows] = await Promise.all([
      db
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
        .where(where)
        .orderBy(desc(auditLogs.createdAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      db
        .select({ total: sql<number>`count(*)::int` })
        .from(auditLogs)
        .leftJoin(users, eq(auditLogs.userId, users.id))
        .where(where),
      db
        .selectDistinct({ value: auditLogs.action })
        .from(auditLogs)
        .where(tenantFilter)
        .orderBy(auditLogs.action),
      db
        .selectDistinct({ value: auditLogs.entity })
        .from(auditLogs)
        .where(tenantFilter)
        .orderBy(auditLogs.entity),
    ]);

    return NextResponse.json({
      rows,
      total,
      page,
      pageSize,
      actions: actionRows.map((r) => r.value),
      entities: entityRows.map((r) => r.value),
    });
  } catch (error) {
    console.error("GET audit logs error:", error);

    return NextResponse.json(
      { error: "Failed to fetch audit logs" },
      { status: 500 },
    );
  }
}
