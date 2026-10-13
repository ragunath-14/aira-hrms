import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { salaryStructures } from "@/db/schema";
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
      .delete(salaryStructures)
      .where(and(eq(salaryStructures.id, id), eq(salaryStructures.tenantId, auth.tenant.id)))
      .returning({ id: salaryStructures.id });

    if (!deleted) {
      return NextResponse.json({ error: "Salary structure not found" }, { status: 404 });
    }

    await logAudit({
      tenantId: auth.tenant.id,
      userId: auth.user.id,
      action: "salary_structure_deleted",
      entity: "salary_structure",
      entityId: id,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Salary structure DELETE error:", error);
    return NextResponse.json({ error: "Failed to delete salary structure" }, { status: 500 });
  }
}
