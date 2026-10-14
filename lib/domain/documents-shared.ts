// Constants and helpers used by both the document API and the browser. Keep
// this file free of server-only imports.

export const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024;

export const DOCUMENT_TYPES = [
  { id: "offer_letter", label: "Offer letter" },
  { id: "contract", label: "Contract" },
  { id: "id_proof", label: "ID proof" },
  { id: "address_proof", label: "Address proof" },
  { id: "education", label: "Education certificate" },
  { id: "experience", label: "Experience letter" },
  { id: "resume", label: "Resume" },
  { id: "other", label: "Other" },
] as const;

export const DOCUMENT_TYPE_IDS: string[] = DOCUMENT_TYPES.map((t) => t.id);

export const ALLOWED_FILES_TEXT = "PDF, PNG, JPG, DOC, DOCX, XLS, XLSX, TXT or CSV";

export function formatSize(bytes: number | null | undefined) {
  const n = Number(bytes ?? 0);
  const MB = 1024 * 1024;
  const GB = 1024 * MB;
  const trim = (value: number) => String(Number(value.toFixed(1)));

  if (n < 1024) return `${n} B`;
  if (n < MB) return `${Math.round(n / 1024)} KB`;
  if (n < GB) return `${trim(n / MB)} MB`;

  return `${trim(n / GB)} GB`;
}
