import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/db";
import { users } from "@/db/schema/users";
import {
  chooseMembership,
  listMemberships,
  readActiveTenantId,
} from "@/lib/auth/active-tenant";
import { auth } from "@/lib/auth/server";

// The companies the signed-in person belongs to, and which one they are
// working in. The platform owner's own account is not a company member list.
export async function GET(request: Request) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });

    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const [person] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, session.user.email))
      .limit(1);

    if (!person) return NextResponse.json({ companies: [] });

    const rows = await listMemberships(person.id);
    const active = chooseMembership(rows, readActiveTenantId(request.headers.get("cookie")));

    return NextResponse.json({
      companies: rows.map((row) => ({
        tenantId: row.tenantId,
        name: row.name,
        slug: row.slug,
        role: row.role,
        status: row.accessStatus,
        active: row.tenantId === active?.tenantId,
      })),
    });
  } catch (error) {
    console.error("GET my companies error:", error);

    return NextResponse.json({ error: "Failed to load your companies" }, { status: 500 });
  }
}
