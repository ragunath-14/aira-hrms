"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DownloadIcon, EyeIcon, FileTextIcon, LockIcon } from "lucide-react";
import { toast } from "sonner";

import { DeleteButton } from "@/components/shared/delete-button";
import { EmptyState } from "@/components/shared/empty-state";
import { selectClass } from "@/components/shared/ui-bits";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { DOCUMENT_TYPES, MAX_DOCUMENT_BYTES, formatSize } from "@/lib/domain/documents-shared";
import { errorText } from "@/lib/format/error-text";
import { formatDate } from "@/lib/format/date";

type DocumentItem = {
  id: string;
  name: string;
  type: string | null;
  kind: "file" | "link";
  fileName: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  visibleToEmployee: boolean;
  createdAt: string;
  href: string | null;
  canDelete: boolean;
};

const typeLabel = (type: string | null) =>
  DOCUMENT_TYPES.find((t) => t.id === type)?.label ?? (type ? type.replace(/_/g, " ") : "Document");

const canPreview = (mime: string | null) =>
  mime === "application/pdf" || mime === "image/png" || mime === "image/jpeg";

// Upload, list, view, download and delete employee documents. `hr` mode works
// on one employee's record and can keep a document HR-only; `self` mode is the
// signed-in employee's own page.
export function DocumentsPanel({
  mode,
  employeeId,
}: {
  mode: "hr" | "self";
  employeeId?: string;
}) {
  const base = mode === "hr" ? `/api/employees/${employeeId}/documents` : "/api/employee/documents";

  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const [name, setName] = useState("");
  const [type, setType] = useState("other");
  const [visible, setVisible] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(base);
      const data = await res.json();

      if (!res.ok) throw new Error(errorText(data.error, "Failed to load documents"));

      setDocuments(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load documents");
    } finally {
      setLoading(false);
    }
  }, [base]);

  useEffect(() => {
    load();
  }, [load]);

  function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const chosen = e.target.files?.[0] ?? null;

    setError("");

    if (chosen && chosen.size > MAX_DOCUMENT_BYTES) {
      setError(`That file is too large. The limit is ${formatSize(MAX_DOCUMENT_BYTES)}.`);
      e.target.value = "";
      setFile(null);
      return;
    }

    setFile(chosen);

    if (chosen && !name) setName(chosen.name.replace(/\.[^.]+$/, ""));
  }

  async function upload(e: React.FormEvent) {
    e.preventDefault();

    if (!file) return;

    setUploading(true);
    setError("");

    try {
      const form = new FormData();
      form.set("file", file);
      form.set("name", name.trim());
      form.set("type", type);
      form.set("visibleToEmployee", String(visible));

      const res = await fetch(base, { method: "POST", body: form });
      const data = await res.json();

      if (!res.ok) throw new Error(errorText(data.error, "Upload failed"));

      toast.success("Document uploaded");
      setName("");
      setType("other");
      setVisible(true);
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
      await load();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Upload failed";
      setError(message);
      toast.error(message);
    } finally {
      setUploading(false);
    }
  }

  const deleteUrl = (id: string) =>
    mode === "hr" ? `/api/documents/${id}` : `/api/employee/documents/${id}`;

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="px-6">
          <h2 className="mb-1 text-lg font-semibold text-foreground">Upload a document</h2>
          <p className="mb-4 text-sm text-muted-foreground">
            PDF, PNG, JPG, Word, Excel, TXT or CSV, up to {formatSize(MAX_DOCUMENT_BYTES)}.
          </p>

          <form onSubmit={upload} className="grid gap-4 md:grid-cols-3">
            <div>
              <Label htmlFor="doc-file" className="mb-1.5">File</Label>
              <Input
                id="doc-file"
                ref={fileRef}
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx,.txt,.csv"
                onChange={pick}
              />
            </div>
            <div>
              <Label htmlFor="doc-name" className="mb-1.5">Name</Label>
              <Input
                id="doc-name"
                value={name}
                maxLength={120}
                placeholder="e.g. Aadhaar card"
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="doc-type" className="mb-1.5">Type</Label>
              <select id="doc-type" className={selectClass} value={type} onChange={(e) => setType(e.target.value)}>
                {DOCUMENT_TYPES.map((t) => (
                  <option key={t.id} value={t.id}>{t.label}</option>
                ))}
              </select>
            </div>

            {mode === "hr" && (
              <label className="flex items-center gap-2 text-sm md:col-span-3">
                <input
                  type="checkbox"
                  className="size-4 rounded border-input accent-primary"
                  checked={visible}
                  onChange={(e) => setVisible(e.target.checked)}
                />
                Show this document to the employee in My Workspace
                <span className="text-xs text-muted-foreground">(untick for HR-only notes and letters)</span>
              </label>
            )}

            {error && <p className="text-sm text-destructive md:col-span-3" role="alert">{error}</p>}

            <div className="flex justify-end md:col-span-3">
              <Button type="submit" disabled={uploading || !file}>
                {uploading ? "Uploading…" : "Upload"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="overflow-hidden p-0">
        <div className="border-b px-6 py-4">
          <h2 className="text-lg font-semibold text-foreground">
            {mode === "hr" ? "Documents" : "My documents"} ({documents.length})
          </h2>
        </div>

        {loading ? (
          <div className="space-y-2 p-6">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : documents.length === 0 ? (
          <EmptyState icon={FileTextIcon} title="No documents yet" description="Uploaded documents will appear here." />
        ) : (
          <div className="divide-y">
            {documents.map((doc) => (
              <div key={doc.id} className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">{doc.name}</p>
                  <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                    <span>{typeLabel(doc.type)}</span>
                    {doc.kind === "file" && doc.sizeBytes ? <span>· {formatSize(doc.sizeBytes)}</span> : null}
                    <span>· {formatDate(doc.createdAt)}</span>
                    {mode === "hr" && !doc.visibleToEmployee && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-amber-700 dark:text-amber-400">
                        <LockIcon className="size-3" /> HR only
                      </span>
                    )}
                  </p>
                </div>

                <div className="flex items-center gap-1">
                  {doc.href && (
                    <>
                      {(doc.kind === "link" || canPreview(doc.mimeType) || !doc.mimeType) && (
                        <Button
                          variant="outline"
                          size="sm"
                          render={
                            <a
                              href={doc.kind === "file" ? `${doc.href}?inline=1` : doc.href}
                              target="_blank"
                              rel="noreferrer"
                            />
                          }
                        >
                          <EyeIcon /> View
                        </Button>
                      )}
                      {doc.kind === "file" && (
                        <Button variant="outline" size="sm" render={<a href={doc.href} download />}>
                          <DownloadIcon /> Download
                        </Button>
                      )}
                    </>
                  )}
                  {doc.canDelete && (
                    <DeleteButton
                      anyone
                      url={deleteUrl(doc.id)}
                      itemName={doc.name}
                      description="The file is permanently removed."
                      onDeleted={load}
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
