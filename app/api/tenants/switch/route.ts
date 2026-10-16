import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/db";
import { users } from "@/db/schema/users";
import { ACTIVE_TENANT_COOKIE, listMemberships } from "@/lib/auth/active-tenant";
import { auth } from "@/lib/auth/server";

const bodySchema = z.object({ tenantId: z.string().uuid("Choose a company") }).strict();

// Work in another of your companies. Only companies you really belong to (and
// that are approved) can be chosen; the choice is just a cookie, and every
// request re-checks it against your memberships.
export async function POST(request: Request) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });

    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const parsed = bodySchema.safeParse(await request.json().catch(() => null));

    if (!parsed.success) {
      return NextResponse.json({ error: "Choose a company" }, { status: 400 });
    }

    const [person] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, session.user.email))
      .limit(1);

    const mine = person ? await listMemberships(person.id) : [];
    const target = mine.find((row) => row.tenantId === parsed.data.tenantId.toLowerCase());

    if (!target) {
      return NextResponse.json({ error: "You do not belong to that company" }, { status: 403 });
    }

    if (target.accessStatus !== "approved") {
      return NextResponse.json({ error: "That company is not active right now" }, { status: 403 });
    }

    const response = NextResponse.json({
      tenantId: target.tenantId,
      name: target.name,
      role: target.role,
    });

    response.cookies.set({
      name: ACTIVE_TENANT_COOKIE,
      value: target.tenantId,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });

    return response;
  } catch (error) {
    console.error("POST switch company error:", error);

    return NextResponse.json({ error: "Failed to switch company" }, { status: 500 });
  }
}
