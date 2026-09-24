import { isUuid } from "@/lib/ids";
import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { employees, leavePlans } from "@/db/schema";
import { getCurrentTenant } from "@/lib/authorization";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const context = await getCurrentTenant(request);

    if (!context) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { user, tenant } = context;
    const { id } = await params;
    if (!isUuid(id)) {
      return Response.json({ error: "Invalid id" }, { status: 400 });
    }

    const [employee] = await db
      .select({ id: employees.id })
      .from(employees)
      .where(and(eq(employees.userId, user.id), eq(employees.tenantId, tenant.id)))
      .limit(1);

    if (!employee) {
      return NextResponse.json(
        { error: "Employee record not found" },
        { status: 404 },
      );
    }

    const [deleted] = await db
      .delete(leavePlans)
      .where(
        and(
          eq(leavePlans.id, id),
          eq(leavePlans.employeeId, employee.id),
          eq(leavePlans.tenantId, tenant.id),
        ),
      )
      .returning();

    if (!deleted) {
      return NextResponse.json(
        { error: "Leave plan not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE leave plan error:", error);

    return NextResponse.json(
      { error: "Failed to delete leave plan" },
      { status: 500 },
    );
  }
}
