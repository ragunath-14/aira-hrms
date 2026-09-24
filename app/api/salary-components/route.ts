import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { requireRole } from "@/lib/authorization";
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

    const body = await request.json();

    const {
      name,
      type,
      amount,
    } = body;

    if (
      !name?.trim() ||
      !type?.trim() ||
      amount === undefined
    ) {
      return NextResponse.json(
        {
          error:
            "name, type and amount are required",
        },
        { status: 400 },
      );
    }

    const [component] = await db
      .insert(salaryComponents)
      .values({
        tenantId: auth.tenant.id,
        name: name.trim(),
        type: type.trim(),
        amount: String(amount),
      })
      .returning();

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
