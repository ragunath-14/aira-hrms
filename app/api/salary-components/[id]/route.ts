import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { salaryComponents } from "@/db/schema";
import { requireRole } from "@/lib/auth/authorization";
import { logAudit } from "@/lib/domain/audit";
import { isUuid } from "@/lib/validation/ids";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireRole(request, ["owner", "admin", "hr"]);

    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { id } = await params;
    if (!isUuid(id)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const [deleted] = await db
      .delete(salaryComponents)
      .where(and(eq(salaryComponents.id, id), eq(salaryComponents.tenantId, auth.tenant.id)))
      .returning({ id: salaryComponents.id });

    if (!deleted) {
      return NextResponse.json({ error: "Salary component not found" }, { status: 404 });
    }

    await logAudit({
      tenantId: auth.tenant.id,
      userId: auth.user.id,
      action: "salary_component_deleted",
      entity: "salary_component",
      entityId: id,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Salary component DELETE error:", error);
    return NextResponse.json({ error: "Failed to delete salary component" }, { status: 500 });
  }
}
