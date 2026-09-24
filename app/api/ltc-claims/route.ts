import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { ltcClaims } from "@/db/schema";
import { requireRole } from "@/lib/authorization";

export async function GET(request: Request) {
  try {
    const auth = await requireRole(request, [
      "owner",
      "admin",
      "hr",
      "manager",
    ]);

    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");

    const conditions = [eq(ltcClaims.tenantId, auth.tenant.id)];

    if (status) {
      conditions.push(eq(ltcClaims.status, status));
    }

    const claims = await db
      .select()
      .from(ltcClaims)
      .where(and(...conditions));

    return NextResponse.json(claims);
  } catch (error) {
    console.error("GET admin LTC claims error:", error);

    return NextResponse.json(
      { error: "Failed to fetch LTC claims" },
      { status: 500 },
    );
  }
}
