
import { db } from "@/db";
import { tenants } from "@/db/schema";
import { requireRole } from "@/lib/authorization";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { logAudit } from "@/lib/audit";
import { companyUpdateSchema } from "@/lib/validations";

export async function GET(request: Request) {
  try {
    const auth = await requireRole(request, [
      "owner",
      "admin",
      "hr",
    ]);

    if (!auth.authorized) {
      return NextResponse.json(
        { error: auth.error },
        { status: auth.status },
      );
    }

    const company = await db
      .select()
      .from(tenants)
      .where(eq(tenants.id, auth.tenant.id))
      .limit(1);

    if (!company.length) {
      return NextResponse.json(
        { error: "Company not found" },
        { status: 404 },
      );
    }

    return NextResponse.json(company[0]);
  } catch (error) {
    console.error("Company profile GET error:", error);

    return NextResponse.json(
      { error: "Failed to fetch company profile" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await requireRole(request, [
      "owner",
      "admin",
      "hr",
    ]);

    if (!auth.authorized) {
      return NextResponse.json(
        { error: auth.error },
        { status: auth.status },
      );
    }

    const body = await request.json();

    const parsed = companyUpdateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const updatedCompany = await db
      .update(tenants)
      .set({
        ...parsed.data,
        updatedAt: new Date(),
      })
      .where(eq(tenants.id, auth.tenant.id))
      .returning();

    if (!updatedCompany.length) {
      return NextResponse.json(
        { error: "Company not found" },
        { status: 404 },
      );
    }

    await logAudit({
      tenantId: auth.tenant.id,
      userId: auth.user.id,
      action: "company_settings_changed",
      entity: "tenant",
      entityId: auth.tenant.id,
    });

    return NextResponse.json(updatedCompany[0]);
  } catch (error) {
    console.error("Company profile PATCH error:", error);

    return NextResponse.json(
      { error: "Failed to update company profile" },
      { status: 500 },
    );
  }
}