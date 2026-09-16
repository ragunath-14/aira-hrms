import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { employeeDocuments } from "@/db/schema/employee-documents";
import { employees } from "@/db/schema/employees";
import { getCurrentTenant } from "@/lib/authorization";

export async function GET(request: Request) {
  try {
    const context = await getCurrentTenant(request);

    if (!context) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { user, tenant } = context;

    const [employee] = await db
      .select()
      .from(employees)
      .where(
        and(
          eq(employees.tenantId, tenant.id),
          eq(employees.userId, user.id),
        ),
      )
      .limit(1);

    if (!employee) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    }

    const docs = await db
      .select()
      .from(employeeDocuments)
      .where(
        and(
          eq(employeeDocuments.employeeId, employee.id),
          eq(employeeDocuments.tenantId, tenant.id),
        ),
      );

    return NextResponse.json(docs);
  } catch (error) {
    console.error("GET employee documents error:", error);
    return NextResponse.json({ error: "Failed to fetch documents" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const context = await getCurrentTenant(request);

    if (!context) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { user, tenant } = context;

    const [employee] = await db
      .select()
      .from(employees)
      .where(
        and(
          eq(employees.tenantId, tenant.id),
          eq(employees.userId, user.id),
        ),
      )
      .limit(1);

    if (!employee) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    }

    const body = await request.json();

    if (!body.name?.trim() || !body.url?.trim()) {
      return NextResponse.json({ error: "name and url are required" }, { status: 400 });
    }

    const [doc] = await db
      .insert(employeeDocuments)
      .values({
        tenantId: tenant.id,
        employeeId: employee.id,
        name: body.name.trim(),
        type: body.type?.trim() ?? null,
        url: body.url.trim(),
      })
      .returning();

    return NextResponse.json(doc, { status: 201 });
  } catch (error) {
    console.error("POST employee document error:", error);
    return NextResponse.json({ error: "Failed to upload document" }, { status: 500 });
  }
}
