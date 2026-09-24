"use client";

import { useEffect, useMemo, useState } from "react";
import { ScrollTextIcon } from "lucide-react";

import { PageHeader } from "@/components/hr/page-header";
import { EmptyState } from "@/components/hr/empty-state";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DataTablePagination,
  paginate,
} from "@/components/hr/data-table-pagination";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type AuditLog = {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  createdAt: string;
  userId: string | null;
  userName: string | null;
  userEmail: string | null;
};

const PAGE_SIZE = 15;

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError("");
        const response = await fetch("/api/audit-logs");
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || "Failed to fetch audit logs");
        }
        setLogs(Array.isArray(data) ? data : []);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to fetch audit logs",
        );
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  const pagedLogs = useMemo(() => paginate(logs, page, PAGE_SIZE), [logs, page]);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Audit Logs"
        description="A record of important actions taken across your organisation."
      />

      {error && (
        <div className="mb-4 rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <Card className="overflow-hidden p-0">
        {loading ? (
          <div className="space-y-2 p-6">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-10 w-full" />
            ))}
          </div>
        ) : logs.length === 0 ? (
          <EmptyState
            icon={ScrollTextIcon}
            title="No audit activity yet"
            description="Actions like employee changes, leave approvals and role updates will show up here."
          />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Action</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>Performed By</TableHead>
                  <TableHead>When</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagedLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>
                      <Badge variant="outline">
                        {log.action.replace(/_/g, " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {log.entity}
                    </TableCell>
                    <TableCell className="text-foreground">
                      {log.userName ?? log.userEmail ?? "System"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(log.createdAt).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <DataTablePagination
              page={page}
              pageSize={PAGE_SIZE}
              total={logs.length}
              onPageChange={setPage}
            />
          </>
        )}
      </Card>
    </div>
  );
}
