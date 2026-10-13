import { NextResponse } from "next/server";
import { and, desc, eq, gte, ilike, inArray, lt, or, sql } from "drizzle-orm";

import { db } from "@/db";
import { auditLogs } from "@/db/schema/audit-logs";
import { tenants } from "@/db/schema/tenants";
import { users } from "@/db/schema/users";
import { requireSuperAdmin } from "@/lib/auth/authorization";
import { isRealDate } from "@/lib/validation/schemas";

const MAX_PAGE_SIZE = 100;

// The platform owner's own trail: what platform administrators did (created
// companies, suspended or restored access, reset owner passwords, signed in).
// It lists only actions performed by platform administrators, never what
// happens inside a company, so company data stays private.
export async function GET(request: Request) {
  try {
    const auth = await requireSuperAdmin(request);

    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { searchParams } = new URL(request.url);
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

    const platformAdmins = db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.isSuperAdmin, true));

    const base = inArray(auditLogs.userId, platformAdmins);
    const conditions = [base];

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
          ilike(tenants.name, like),
          ilike(auditLogs.action, like),
        )!,
      );
    }

    const where = and(...conditions);

    const [rows, [{ total }], actionRows] = await Promise.all([
      db
        .select({
          id: auditLogs.id,
          action: auditLogs.action,
          entity: auditLogs.entity,
          createdAt: auditLogs.createdAt,
          actorName: users.name,
          actorEmail: users.email,
          company: tenants.name,
        })
        .from(auditLogs)
        .leftJoin(users, eq(users.id, auditLogs.userId))
        .innerJoin(tenants, eq(tenants.id, auditLogs.tenantId))
        .where(where)
        .orderBy(desc(auditLogs.createdAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      db
        .select({ total: sql<number>`count(*)::int` })
        .from(auditLogs)
        .leftJoin(users, eq(users.id, auditLogs.userId))
        .innerJoin(tenants, eq(tenants.id, auditLogs.tenantId))
        .where(where),
      db
        .selectDistinct({ value: auditLogs.action })
        .from(auditLogs)
        .where(base)
        .orderBy(auditLogs.action),
    ]);

    return NextResponse.json({
      rows,
      total,
      page,
      pageSize,
      actions: actionRows.map((r) => r.value),
    });
  } catch (error) {
    console.error("GET platform audit logs error:", error);

    return NextResponse.json(
      { error: "Failed to fetch the platform audit log" },
      { status: 500 },
    );
  }
}
