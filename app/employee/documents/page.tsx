"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { FileTextIcon } from "lucide-react";

import { EmptyState } from "@/components/hr/empty-state";
import {
  DataTablePagination,
  paginate,
} from "@/components/hr/data-table-pagination";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

type Document = {
  id: string;
  name: string;
  type: string | null;
  url: string;
  createdAt: string;
};

const PAGE_SIZE = 10;

export default function EmployeeDocumentsPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  const [docName, setDocName] = useState("");
  const [docType, setDocType] = useState("");
  const [docUrl, setDocUrl] = useState("");
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [docMsg, setDocMsg] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  async function loadDocuments() {
    try {
      const res = await fetch("/api/employee/documents");
      if (res.ok) {
        const d = await res.json();
        setDocuments(Array.isArray(d) ? d : []);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDocuments();
  }, []);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setDocUrl(reader.result as string);
      if (!docName) setDocName(file.name);
    };
    reader.readAsDataURL(file);
  }

  async function handleDocUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!docName || !docUrl) {
      setDocMsg("Name and file are required");
      return;
    }
    setUploadingDoc(true);
    setDocMsg("");
    try {
      const res = await fetch("/api/employee/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: docName, type: docType || null, url: docUrl }),
      });
      const d = await res.json();
      if (!res.ok) {
        setDocMsg(d.error ?? "Upload failed");
      } else {
        setDocMsg("Document uploaded successfully!");
        setDocName("");
        setDocType("");
        setDocUrl("");
        if (fileRef.current) fileRef.current.value = "";
        await loadDocuments();
      }
    } catch {
      setDocMsg("Upload failed");
    } finally {
      setUploadingDoc(false);
    }
  }

  const paged = useMemo(() => paginate(documents, page, PAGE_SIZE), [documents, page]);
  const docMsgIsError = docMsg.includes("failed") || docMsg.includes("Failed");

  if (loading) {
    return <Skeleton className="h-64 w-full" />;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Upload Document</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleDocUpload} className="grid gap-4 md:grid-cols-3">
            <div>
              <Label className="mb-1.5">Document Name</Label>
              <Input
                value={docName}
                onChange={(e) => setDocName(e.target.value)}
                required
                placeholder="e.g. Aadhaar Card"
              />
            </div>
            <div>
              <Label className="mb-1.5">Type (optional)</Label>
              <Input
                value={docType}
                onChange={(e) => setDocType(e.target.value)}
                placeholder="e.g. id_proof"
              />
            </div>
            <div>
              <Label className="mb-1.5">File</Label>
              <Input ref={fileRef} type="file" onChange={handleFileChange} />
            </div>

            {docMsg && (
              <p className={`text-sm md:col-span-3 ${docMsgIsError ? "text-destructive" : "text-primary"}`}>
                {docMsg}
              </p>
            )}

            <div className="flex justify-end md:col-span-3">
              <Button type="submit" disabled={uploadingDoc || !docUrl}>
                {uploadingDoc ? "Uploading…" : "Upload"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="overflow-hidden p-0">
        <div className="border-b px-6 py-4">
          <h2 className="text-lg font-semibold text-foreground">My Documents ({documents.length})</h2>
        </div>
        {documents.length === 0 ? (
          <EmptyState icon={FileTextIcon} title="No documents uploaded" />
        ) : (
          <>
            <div className="divide-y">
              {paged.map((doc) => (
                <div key={doc.id} className="flex items-center justify-between px-6 py-4">
                  <div>
                    <p className="font-medium text-foreground">{doc.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {doc.type ?? "document"} · {new Date(doc.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    render={<a href={doc.url} target="_blank" rel="noreferrer" />}
                  >
                    View
                  </Button>
                </div>
              ))}
            </div>
            <DataTablePagination
              page={page}
              pageSize={PAGE_SIZE}
              total={documents.length}
              onPageChange={setPage}
            />
          </>
        )}
      </Card>
    </div>
  );
}
