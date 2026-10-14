import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/db";
import { employeeDocuments } from "@/db/schema/employee-documents";
import { employees } from "@/db/schema/employees";
import { requireRole } from "@/lib/auth/authorization";
import { logAudit } from "@/lib/domain/audit";
import {
  listDocuments,
  storeLinkDocument,
  storeUploadedDocument,
  validLinkUrl,
} from "@/lib/domain/document-store";
import { DOCUMENT_TYPE_IDS, documentView, parseUpload } from "@/lib/domain/documents";
import { createNotification } from "@/lib/domain/notifications";
import { isUuid } from "@/lib/validation/ids";

type Ctx = { params: Promise<{ id: string }> };

async function findEmployee(tenantId: string, id: string) {
  const [employee] = await db
    .select({ id: employees.id, userId: employees.userId })
    .from(employees)
    .where(and(eq(employees.id, id), eq(employees.tenantId, tenantId)))
    .limit(1);

  return employee ?? null;
}

// Documents can hold ID proofs and contracts, so only owner, admin and HR see
// everything here. (Managers are deliberately not included.)
export async function GET(request: Request, { params }: Ctx) {
  try {
    const auth = await requireRole(request, ["owner", "admin", "hr"]);

    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { id } = await params;
    if (!isUuid(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

    if (!(await findEmployee(auth.tenant.id, id))) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    }

    return NextResponse.json(
      await listDocuments({ tenantId: auth.tenant.id, employeeId: id, viewer: { kind: "hr" } }),
    );
  } catch (error) {
    console.error("GET employee documents by id error:", error);

    return NextResponse.json({ error: "Failed to fetch employee documents" }, { status: 500 });
  }
}

// Upload a file (multipart: file, name, type, visibleToEmployee) or add a link
// (JSON: name, url, type).
export async function POST(request: Request, { params }: Ctx) {
  try {
    const auth = await requireRole(request, ["owner", "admin", "hr"]);

    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { id } = await params;
    if (!isUuid(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

    const employee = await findEmployee(auth.tenant.id, id);

    if (!employee) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    }

    let created;
    let visible = true;

    if ((request.headers.get("content-type") ?? "").startsWith("multipart/form-data")) {
      const upload = await parseUpload(request);

      if (!upload.ok) return upload.response;

      visible = upload.visibleToEmployee;

      const stored = await storeUploadedDocument({
        tenant: auth.tenant,
        employeeId: id,
        uploadedBy: auth.user.id,
        upload,
        visibleToEmployee: visible,
      });

      if (stored.error) return stored.error;

      created = stored.document;
    } else {
      const body = await request.json().catch(() => null);
      const url = validLinkUrl(body?.url);
      const name = typeof body?.name === "string" ? body.name.trim() : "";
      const type = typeof body?.type === "string" && body.type ? body.type.trim() : null;

      if (!name || name.length > 120) {
        return NextResponse.json({ error: "Enter a document name" }, { status: 400 });
      }

      if (!url) {
        return NextResponse.json(
          { error: "Links must be full web addresses starting with http:// or https://" },
          { status: 400 },
        );
      }

      if (type && !DOCUMENT_TYPE_IDS.includes(type)) {
        return NextResponse.json({ error: "Choose a document type from the list" }, { status: 400 });
      }

      visible = body?.visibleToEmployee !== false;

      created = await storeLinkDocument({
        tenantId: auth.tenant.id,
        employeeId: id,
        uploadedBy: auth.user.id,
        name,
        type,
        url,
        visibleToEmployee: visible,
      });
    }

    await logAudit({
      tenantId: auth.tenant.id,
      userId: auth.user.id,
      action: "document_uploaded",
      entity: "employee_document",
      entityId: created.id,
    });

    if (visible && employee.userId && employee.userId !== auth.user.id) {
      await createNotification({
        tenantId: auth.tenant.id,
        userId: employee.userId,
        type: "document_added",
        title: "New document",
        message: `"${created.name}" was added to your documents.`,
        link: "/employee/documents",
      });
    }

    return NextResponse.json({ ...documentView(created), canDelete: true }, { status: 201 });
  } catch (error) {
    console.error("POST employee document by id error:", error);

    return NextResponse.json({ error: "Failed to upload document" }, { status: 500 });
  }
}

// Older clients delete through here with the document id in the path and the
// employee in the query string; the Documents tab now uses DELETE /api/documents/[id].
export async function DELETE(request: Request, { params }: Ctx) {
  try {
    const auth = await requireRole(request, ["owner", "admin", "hr"]);

    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { id: docId } = await params;
    if (!isUuid(docId)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

    const employeeId = new URL(request.url).searchParams.get("employeeId");

    if (!employeeId || !isUuid(employeeId)) {
      return NextResponse.json({ error: "A valid employeeId query param is required" }, { status: 400 });
    }

    const deleted = await db
      .delete(employeeDocuments)
      .where(
        and(
          eq(employeeDocuments.id, docId),
          eq(employeeDocuments.tenantId, auth.tenant.id),
          eq(employeeDocuments.employeeId, employeeId),
        ),
      )
      .returning({ id: employeeDocuments.id });

    if (deleted.length === 0) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE employee document error:", error);

    return NextResponse.json({ error: "Failed to delete document" }, { status: 500 });
  }
}
