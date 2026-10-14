import { NextResponse } from "next/server";

import type { employeeDocuments } from "@/db/schema";
import {
  ALLOWED_FILES_TEXT,
  DOCUMENT_TYPE_IDS,
  MAX_DOCUMENT_BYTES,
  formatSize,
} from "@/lib/domain/documents-shared";

export {
  ALLOWED_FILES_TEXT,
  DOCUMENT_TYPES,
  DOCUMENT_TYPE_IDS,
  MAX_DOCUMENT_BYTES,
  formatSize,
} from "@/lib/domain/documents-shared";

type Kind = { mime: string; ext: string; inline: boolean };

const starts = (bytes: Uint8Array, signature: number[]) =>
  signature.every((byte, index) => bytes[index] === byte);

// Decides what a file really is from its first bytes, never from the name or
// the type the browser claims, so an executable renamed to .pdf is refused.
// Only a short list of office-document types is accepted at all: no scripts,
// no HTML, no SVG (which can carry script).
export function detectFileType(bytes: Uint8Array, fileName: string): Kind | null {
  const ext = fileName.toLowerCase().split(".").pop() ?? "";

  if (starts(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) {
    return ext === "pdf" ? { mime: "application/pdf", ext: "pdf", inline: true } : null;
  }

  if (starts(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return ext === "png" ? { mime: "image/png", ext: "png", inline: true } : null;
  }

  if (starts(bytes, [0xff, 0xd8, 0xff])) {
    return ext === "jpg" || ext === "jpeg" ? { mime: "image/jpeg", ext, inline: true } : null;
  }

  // .docx and .xlsx are zip files.
  if (starts(bytes, [0x50, 0x4b, 0x03, 0x04])) {
    if (ext === "docx") {
      return { mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", ext, inline: false };
    }
    if (ext === "xlsx") {
      return { mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", ext, inline: false };
    }
    return null;
  }

  // Older .doc and .xls share one container signature.
  if (starts(bytes, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) {
    if (ext === "doc") return { mime: "application/msword", ext, inline: false };
    if (ext === "xls") return { mime: "application/vnd.ms-excel", ext, inline: false };
    return null;
  }

  if (ext === "txt" || ext === "csv") {
    const head = bytes.subarray(0, 8000);

    if (head.includes(0)) return null;

    try {
      new TextDecoder("utf-8", { fatal: true }).decode(head);
    } catch {
      return null;
    }

    return { mime: ext === "csv" ? "text/csv" : "text/plain", ext, inline: false };
  }

  return null;
}

// A name safe to show and to send in a download header.
export function safeFileName(name: string) {
  const cleaned = name
    .replace(/[\\/]/g, " ")
    .replace(/[\u0000-\u001f\u007f"<>:|?*]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  return (cleaned || "document").slice(-120);
}

type DocumentRow = typeof employeeDocuments.$inferSelect;

// What the browser gets about a document. Never the raw url: a legacy upload
// stored the whole file in it as a data: address, and a link could in theory
// hold anything, so only http(s) addresses and our own download path go out.
export function documentView(row: DocumentRow) {
  const isFile = row.kind === "file" || row.url.startsWith("data:");
  const href = isFile
    ? `/api/documents/${row.id}/file`
    : /^https?:\/\//i.test(row.url)
      ? row.url
      : null;

  return {
    id: row.id,
    name: row.name,
    type: row.type,
    kind: isFile ? "file" : "link",
    fileName: row.fileName,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    visibleToEmployee: row.visibleToEmployee,
    uploadedBy: row.uploadedBy,
    createdAt: row.createdAt,
    href,
  };
}

export type ParsedUpload =
  | {
      ok: true;
      name: string;
      type: string;
      visibleToEmployee: boolean;
      file: { bytes: Buffer; fileName: string; mime: string; size: number };
    }
  | { ok: false; response: NextResponse };

const reject = (error: string, status = 400): ParsedUpload => ({
  ok: false,
  response: NextResponse.json({ error }, { status }),
});

// Reads and checks a multipart upload (file, name, type, visibleToEmployee).
export async function parseUpload(request: Request): Promise<ParsedUpload> {
  // Refuse an oversized body before reading it all into memory.
  const declared = Number(request.headers.get("content-length") ?? 0);

  if (declared > MAX_DOCUMENT_BYTES + 512 * 1024) {
    return reject(`That file is too large. The limit is ${formatSize(MAX_DOCUMENT_BYTES)}.`, 413);
  }

  let form: FormData;

  try {
    form = await request.formData();
  } catch {
    return reject("Send the file as a form upload");
  }

  const file = form.get("file");

  if (!(file instanceof File) || file.size === 0) return reject("Choose a file to upload");

  if (file.size > MAX_DOCUMENT_BYTES) {
    return reject(`That file is too large. The limit is ${formatSize(MAX_DOCUMENT_BYTES)}.`, 413);
  }

  const fileName = safeFileName(file.name);
  const bytes = Buffer.from(await file.arrayBuffer());
  const kind = detectFileType(bytes, fileName);

  if (!kind) {
    return reject(`That file type is not allowed. Upload a ${ALLOWED_FILES_TEXT} file.`, 415);
  }

  const name = String(form.get("name") ?? "").trim() || fileName.replace(/\.[^.]+$/, "");

  if (name.length > 120) return reject("The document name is too long");

  const type = String(form.get("type") ?? "other").trim() || "other";

  if (!DOCUMENT_TYPE_IDS.includes(type)) return reject("Choose a document type from the list");

  return {
    ok: true,
    name,
    type,
    visibleToEmployee: String(form.get("visibleToEmployee") ?? "true") !== "false",
    file: { bytes, fileName, mime: kind.mime, size: bytes.length },
  };
}

export function isInlineMime(mime: string | null | undefined) {
  return mime === "application/pdf" || mime === "image/png" || mime === "image/jpeg";
}
