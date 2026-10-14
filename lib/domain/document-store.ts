import { and, desc, eq, or } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/db";
import { documentFiles, employeeDocuments } from "@/db/schema";
import { checkCanStore } from "@/lib/domain/plans";
import { documentView, type ParsedUpload } from "@/lib/domain/documents";
import type { PlanFields } from "@/lib/config/plans";

type Upload = Extract<ParsedUpload, { ok: true }>;

// Saves an uploaded file for an employee: the details in employee_documents and
// the bytes in document_files, together or not at all. Returns an error
// response when the company's plan has no room (or has expired).
export async function storeUploadedDocument(params: {
  tenant: PlanFields & { id: string };
  employeeId: string;
  uploadedBy: string;
  upload: Upload;
  visibleToEmployee: boolean;
}) {
  const { tenant, upload } = params;

  const problem = await checkCanStore(tenant, upload.file.size);

  if (problem) {
    return { error: NextResponse.json({ error: problem }, { status: 402 }) };
  }

  const id = crypto.randomUUID();

  const row = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(employeeDocuments)
      .values({
        id,
        tenantId: tenant.id,
        employeeId: params.employeeId,
        name: upload.name,
        type: upload.type,
        url: `/api/documents/${id}/file`,
        kind: "file",
        fileName: upload.file.fileName,
        mimeType: upload.file.mime,
        sizeBytes: upload.file.size,
        visibleToEmployee: params.visibleToEmployee,
        uploadedBy: params.uploadedBy,
      })
      .returning();

    await tx.insert(documentFiles).values({
      documentId: id,
      tenantId: tenant.id,
      data: upload.file.bytes,
    });

    return created;
  });

  return { document: row };
}

// Adds a link (an address, not a file). Only web addresses are accepted.
export async function storeLinkDocument(params: {
  tenantId: string;
  employeeId: string;
  uploadedBy: string;
  name: string;
  type: string | null;
  url: string;
  visibleToEmployee: boolean;
}) {
  const [row] = await db
    .insert(employeeDocuments)
    .values({
      tenantId: params.tenantId,
      employeeId: params.employeeId,
      name: params.name,
      type: params.type,
      url: params.url,
      kind: "link",
      visibleToEmployee: params.visibleToEmployee,
      uploadedBy: params.uploadedBy,
    })
    .returning();

  return row;
}

// HR sees every document of an employee; the employee sees what HR has shared
// with them plus anything they uploaded themselves.
export async function listDocuments(params: {
  tenantId: string;
  employeeId: string;
  viewer: { kind: "hr" } | { kind: "employee"; userId: string };
}) {
  const rows = await db
    .select()
    .from(employeeDocuments)
    .where(
      and(
        eq(employeeDocuments.tenantId, params.tenantId),
        eq(employeeDocuments.employeeId, params.employeeId),
        params.viewer.kind === "employee"
          ? or(
              eq(employeeDocuments.visibleToEmployee, true),
              eq(employeeDocuments.uploadedBy, params.viewer.userId),
            )
          : undefined,
      ),
    )
    .orderBy(desc(employeeDocuments.createdAt));

  return rows.map((row) => ({
    ...documentView(row),
    canDelete:
      params.viewer.kind === "hr" || row.uploadedBy === params.viewer.userId,
  }));
}

const WEB_ADDRESS = /^https?:\/\/[^\s]+$/i;

export function validLinkUrl(value: unknown) {
  return typeof value === "string" && value.length <= 2000 && WEB_ADDRESS.test(value.trim())
    ? value.trim()
    : null;
}
