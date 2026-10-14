import { NextResponse } from "next/server";

import { DOCUMENT_TYPE_IDS, documentView, parseUpload } from "@/lib/domain/documents";
import {
  listDocuments,
  storeLinkDocument,
  storeUploadedDocument,
  validLinkUrl,
} from "@/lib/domain/document-store";
import { getActor, serverError, unauthorized } from "@/lib/domain/workplace";

// My Workspace -> Documents. An employee sees what HR has shared with them and
// what they uploaded themselves; documents HR marked HR-only stay hidden.
export async function GET(request: Request) {
  try {
    const actor = await getActor(request);
    if (!actor) return unauthorized();

    return NextResponse.json(
      await listDocuments({
        tenantId: actor.tenant.id,
        employeeId: actor.employee.id,
        viewer: { kind: "employee", userId: actor.user.id },
      }),
    );
  } catch (error) {
    return serverError("Documents load", error);
  }
}

// Upload a file (multipart: file, name, type) or add a link (JSON: name, url, type).
export async function POST(request: Request) {
  try {
    const actor = await getActor(request);
    if (!actor) return unauthorized();

    if ((request.headers.get("content-type") ?? "").startsWith("multipart/form-data")) {
      const upload = await parseUpload(request);

      if (!upload.ok) return upload.response;

      const stored = await storeUploadedDocument({
        tenant: actor.tenant,
        employeeId: actor.employee.id,
        uploadedBy: actor.user.id,
        upload,
        // Something you upload yourself is always yours to see.
        visibleToEmployee: true,
      });

      if (stored.error) return stored.error;

      return NextResponse.json({ ...documentView(stored.document), canDelete: true }, { status: 201 });
    }

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

    const row = await storeLinkDocument({
      tenantId: actor.tenant.id,
      employeeId: actor.employee.id,
      uploadedBy: actor.user.id,
      name,
      type,
      url,
      visibleToEmployee: true,
    });

    return NextResponse.json({ ...documentView(row), canDelete: true }, { status: 201 });
  } catch (error) {
    return serverError("Document upload", error);
  }
}
