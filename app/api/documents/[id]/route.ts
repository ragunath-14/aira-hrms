import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/db";
import { employeeDocuments } from "@/db/schema";
import { requireRole } from "@/lib/auth/authorization";
import { logAudit } from "@/lib/domain/audit";
import { isUuid } from "@/lib/validation/ids";

// HR removes a document (and its file) from an employee's record.
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireRole(request, ["owner", "admin", "hr"]);

    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { id } = await params;
    if (!isUuid(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

    const [deleted] = await db
      .delete(employeeDocuments)
      .where(and(eq(employeeDocuments.id, id), eq(employeeDocuments.tenantId, auth.tenant.id)))
      .returning({ id: employeeDocuments.id });

    if (!deleted) return NextResponse.json({ error: "Document not found" }, { status: 404 });

    await logAudit({
      tenantId: auth.tenant.id,
      userId: auth.user.id,
      action: "document_deleted",
      entity: "employee_document",
      entityId: id,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE document error:", error);

    return NextResponse.json({ error: "Failed to delete document" }, { status: 500 });
  }
}
