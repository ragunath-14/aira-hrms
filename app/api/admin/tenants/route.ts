import { NextResponse } from "next/server";
import { count, eq } from "drizzle-orm";

import { db } from "@/db";
import { tenants } from "@/db/schema/tenants";
import { memberships } from "@/db/schema/memberships";
import { requireSuperAdmin } from "@/lib/authorization";

export async function GET(request: Request) {
  try {
    const auth = await requireSuperAdmin(request);

    if (!auth.authorized) {
      return NextResponse.json(
        { error: auth.error },
        { status: auth.status },
      );
    }

    const allTenants = await db.select().from(tenants);

    const result = await Promise.all(
      allTenants.map(async (tenant) => {
        const [memberCount] = await db
          .select({ count: count() })
          .from(memberships)
          .where(eq(memberships.tenantId, tenant.id));

        return {
          ...tenant,
          memberCount: memberCount.count,
        };
      }),
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error("GET admin tenants error:", error);

    return NextResponse.json(
      { error: "Failed to fetch tenants" },
      { status: 500 },
    );
  }
}
