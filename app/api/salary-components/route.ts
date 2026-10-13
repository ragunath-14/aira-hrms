import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { zodMessage } from "@/lib/format/error-text";
import { salaryComponentSchema } from "@/lib/validation/schemas";
import { logAudit } from "@/lib/domain/audit";
import { requireRole } from "@/lib/auth/authorization";
import { db } from "@/db";
import { salaryComponents } from "@/db/schema";

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

    const components = await db
      .select()
      .from(salaryComponents)
      .where(
        eq(
          salaryComponents.tenantId,
          auth.tenant.id,
        ),
      );

    return NextResponse.json(components);
  } catch (error) {
    console.error(
      "GET salary components error:",
      error,
    );

    return NextResponse.json(
      { error: "Failed to fetch salary components" },
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
    ]);

    if (!auth.authorized) {
      return NextResponse.json(
        { error: auth.error },
        { status: auth.status },
      );
    }

    const parsed = salaryComponentSchema.safeParse(await request.json());

    if (!parsed.success) {
      return NextResponse.json(
        { error: zodMessage(parsed.error) },
        { status: 400 },
      );
    }

    const { name, type, amount } = parsed.data;

    const [component] = await db
      .insert(salaryComponents)
      .values({
        tenantId: auth.tenant.id,
        name,
        type,
        amount: String(amount),
      })
      .returning();

    await logAudit({
      tenantId: auth.tenant.id,
      userId: auth.user.id,
      action: "salary_component_created",
      entity: "salary_component",
      entityId: component.id,
    });

    return NextResponse.json(component, {
      status: 201,
    });
  } catch (error) {
    console.error(
      "POST salary component error:",
      error,
    );

    return NextResponse.json(
      { error: "Failed to create salary component" },
      { status: 500 },
    );
  }
}
