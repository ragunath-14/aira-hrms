import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/db";
import { documentFiles, employeeDocuments, employees } from "@/db/schema";
import { getCurrentTenant } from "@/lib/auth/authorization";
import { logAudit } from "@/lib/domain/audit";
import { isInlineMime, safeFileName } from "@/lib/domain/documents";
import { isUuid } from "@/lib/validation/ids";

const HR_ROLES = ["owner", "admin", "hr"];

const notFound = () => NextResponse.json({ error: "Document not found" }, { status: 404 });

// Older uploads stored the whole file inside the url column as a data: address.
// They are served from here too, but only when they are a type we allow.
function decodeLegacy(url: string) {
  const match = /^data:([a-z0-9.+/-]+);base64,([A-Za-z0-9+/=\s]+)$/i.exec(url);

  if (!match) return null;

  const mime = match[1].toLowerCase();

  return {
    mime: isInlineMime(mime) ? mime : "application/octet-stream",
    bytes: Buffer.from(match[2], "base64"),
  };
}

// Download (or, with ?inline=1, view) a document. Allowed for owner / admin /
// HR of the same company, and for the employee it belongs to unless HR marked
// it HR-only. Everyone else gets "not found", so nobody can probe for ids.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await getCurrentTenant(request);

    if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    if (!isUuid(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

    const [doc] = await db
      .select()
      .from(employeeDocuments)
      .where(and(eq(employeeDocuments.id, id), eq(employeeDocuments.tenantId, context.tenant.id)))
      .limit(1);

    if (!doc) return notFound();

    const isHr = HR_ROLES.includes(context.membership.role);

    const [owner] = await db
      .select({ userId: employees.userId })
      .from(employees)
      .where(eq(employees.id, doc.employeeId))
      .limit(1);

    const isOwn = owner?.userId === context.user.id;

    if (!isHr && !(isOwn && (doc.visibleToEmployee || doc.uploadedBy === context.user.id))) {
      return notFound();
    }

    let bytes: Buffer;
    let mime: string;

    if (doc.kind === "file") {
      const [file] = await db
        .select({ data: documentFiles.data })
        .from(documentFiles)
        .where(and(eq(documentFiles.documentId, doc.id), eq(documentFiles.tenantId, context.tenant.id)))
        .limit(1);

      if (!file) return notFound();

      bytes = file.data;
      mime = doc.mimeType ?? "application/octet-stream";
    } else {
      const legacy = decodeLegacy(doc.url);

      if (!legacy) return notFound();

      bytes = legacy.bytes;
      mime = legacy.mime;
    }

    // Someone in HR opening another person's document is worth a record.
    if (isHr && !isOwn) {
      await logAudit({
        tenantId: context.tenant.id,
        userId: context.user.id,
        action: "document_downloaded",
        entity: "employee_document",
        entityId: doc.id,
      });
    }

    const fileName = safeFileName(doc.fileName ?? doc.name);
    const inline = new URL(request.url).searchParams.get("inline") === "1" && isInlineMime(mime);

    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "Content-Type": mime,
        "Content-Length": String(bytes.length),
        "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${fileName.replace(/[^\x20-\x7e]/g, "_")}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("GET document file error:", error);

    return NextResponse.json({ error: "Failed to load the document" }, { status: 500 });
  }
}
