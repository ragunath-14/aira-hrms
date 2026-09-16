import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { employeeDocuments } from "@/db/schema/employee-documents";
import { employees } from "@/db/schema/employees";
import { requireRole } from "@/lib/authorization";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireRole(request, [
      "owner",
      "admin",
      "hr",
      "manager",
    ]);
    const roleCheck = await requireRole(request, [
  "owner",
  "admin",
  "hr",
  "manager",
  "employee",
]);

if (!roleCheck.authorized) {
  return NextResponse.json(
    { error: roleCheck.error },
    { status: roleCheck.status },
  );
}

    if (!auth.authorized) {
      return NextResponse.json(
        { error: auth.error },
        { status: auth.status },
      );
    }

    const { id } = await context.params;

    // Verify employee belongs to this tenant
    const [employee] = await db
      .select()
      .from(employees)
      .where(
        and(
          eq(employees.id, id),
          eq(employees.tenantId, auth.tenant.id),
        ),
      )
      .limit(1);

    if (!employee) {
      return NextResponse.json(
        { error: "Employee not found" },
        { status: 404 },
      );
    }

    const docs = await db
      .select()
      .from(employeeDocuments)
      .where(
        and(
          eq(employeeDocuments.employeeId, id),
          eq(employeeDocuments.tenantId, auth.tenant.id),
        ),
      );

    return NextResponse.json(docs);
  } catch (error) {
    console.error("GET employee documents by id error:", error);

    return NextResponse.json(
      { error: "Failed to fetch employee documents" },
      { status: 500 },
    );
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireRole(request, [
      "owner",
      "admin",
      "hr",
    ]);
const roleCheck = await requireRole(request, [
  "owner",
  "admin",
  "hr",
  "manager",
  "employee",
]);

if (!roleCheck.authorized) {
  return NextResponse.json(
    { error: roleCheck.error },
    { status: roleCheck.status },
  );
}
    if (!auth.authorized) {
      return NextResponse.json(
        { error: auth.error },
        { status: auth.status },
      );
    }

    const { id } = await context.params;

    // Verify employee belongs to this tenant
    const [employee] = await db
      .select()
      .from(employees)
      .where(
        and(
          eq(employees.id, id),
          eq(employees.tenantId, auth.tenant.id),
        ),
      )
      .limit(1);

    if (!employee) {
      return NextResponse.json(
        { error: "Employee not found" },
        { status: 404 },
      );
    }

    const body = await request.json();

    if (!body.name?.trim() || !body.url?.trim()) {
      return NextResponse.json(
        { error: "name and url are required" },
        { status: 400 },
      );
    }

    const [doc] = await db
      .insert(employeeDocuments)
      .values({
        tenantId: auth.tenant.id,
        employeeId: id,
        name: body.name.trim(),
        type: body.type?.trim() ?? null,
        url: body.url.trim(),
      })
      .returning();

    return NextResponse.json(doc, { status: 201 });
  } catch (error) {
    console.error("POST employee document by id error:", error);

    return NextResponse.json(
      { error: "Failed to upload document" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireRole(request, [
      "owner",
      "admin",
      "hr",
    ]);
    const roleCheck = await requireRole(request, [
  "owner",
  "admin",
  "hr",
  "manager",
  "employee",
]);

if (!roleCheck.authorized) {
  return NextResponse.json(
    { error: roleCheck.error },
    { status: roleCheck.status },
  );
}

    if (!auth.authorized) {
      return NextResponse.json(
        { error: auth.error },
        { status: auth.status },
      );
    }

    const { id: docId } = await context.params;
    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get("employeeId");

    if (!employeeId) {
      return NextResponse.json(
        { error: "employeeId query param required" },
        { status: 400 },
      );
    }

    await db
      .delete(employeeDocuments)
      .where(
        and(
          eq(employeeDocuments.id, docId),
          eq(employeeDocuments.tenantId, auth.tenant.id),
          eq(employeeDocuments.employeeId, employeeId),
        ),
      );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE employee document error:", error);

    return NextResponse.json(
      { error: "Failed to delete document" },
      { status: 500 },
    );
  }
}
