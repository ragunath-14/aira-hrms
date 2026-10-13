"use client";

import { useCallback, useEffect, useState } from "react";
import { DownloadIcon, ScrollTextIcon } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DataTablePagination } from "@/components/shared/data-table-pagination";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { downloadCsv } from "@/lib/format/csv";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { errorText } from "@/lib/format/error-text";
import { formatDateTime } from "@/lib/format/date";

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

const selectClass =
  "h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

const label = (value: string) => value.replace(/_/g, " ");

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [actions, setActions] = useState<string[]>([]);
  const [entities, setEntities] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);

  const [filters, setFilters] = useState({ q: "", action: "", entity: "", from: "", to: "" });
  const [applied, setApplied] = useState(filters);

  const buildQuery = useCallback(
    (pageNumber: number, size: number) => {
      const params = new URLSearchParams({ page: String(pageNumber), pageSize: String(size) });
      for (const [key, value] of Object.entries(applied)) if (value) params.set(key, value);
      return params.toString();
    },
    [applied],
  );

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError("");
        const response = await fetch(`/api/audit-logs?${buildQuery(page, PAGE_SIZE)}`);
        const data = await response.json();
        if (!response.ok) {
          throw new Error(errorText(data.error, "Failed to fetch audit logs"));
        }
        setLogs(data.rows ?? []);
        setTotal(data.total ?? 0);
        setActions(data.actions ?? []);
        setEntities(data.entities ?? []);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to fetch audit logs",
        );
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [page, buildQuery]);

  function applyFilters(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    setApplied(filters);
  }

  function clearFilters() {
    const empty = { q: "", action: "", entity: "", from: "", to: "" };
    setFilters(empty);
    setApplied(empty);
    setPage(1);
  }

  async function exportCsv() {
    const response = await fetch(`/api/audit-logs?${buildQuery(1, 100)}`);
    if (!response.ok) return;
    const data = await response.json();

    downloadCsv(
      `audit-log-${new Date().toISOString().slice(0, 10)}.csv`,
      ["When", "Action", "Entity", "Performed by"],
      (data.rows as AuditLog[]).map((l) => [
        formatDateTime(l.createdAt),
        l.action,
        l.entity,
        l.userName ?? l.userEmail ?? "System",
      ]),
    );
  }

  const hasFilters = Object.values(applied).some(Boolean);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Audit Logs"
        description="A record of important actions taken across your organisation."
        action={
          <Button variant="outline" onClick={exportCsv} disabled={total === 0}>
            <DownloadIcon />
            Export CSV
          </Button>
        }
      />

      <form onSubmit={applyFilters} className="mb-4 flex flex-wrap items-end gap-3">
        <div className="min-w-48 flex-1">
          <label htmlFor="audit-q" className="mb-1.5 block text-xs font-medium text-muted-foreground">Search</label>
          <Input id="audit-q" placeholder="Person, action or entity" value={filters.q} onChange={(e) => setFilters({ ...filters, q: e.target.value })} />
        </div>
        <div>
          <label htmlFor="audit-action" className="mb-1.5 block text-xs font-medium text-muted-foreground">Action</label>
          <select id="audit-action" className={selectClass} value={filters.action} onChange={(e) => setFilters({ ...filters, action: e.target.value })}>
            <option value="">All actions</option>
            {actions.map((a) => <option key={a} value={a}>{label(a)}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="audit-entity" className="mb-1.5 block text-xs font-medium text-muted-foreground">Entity</label>
          <select id="audit-entity" className={selectClass} value={filters.entity} onChange={(e) => setFilters({ ...filters, entity: e.target.value })}>
            <option value="">All entities</option>
            {entities.map((en) => <option key={en} value={en}>{label(en)}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="audit-from" className="mb-1.5 block text-xs font-medium text-muted-foreground">From</label>
          <Input id="audit-from" type="date" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} />
        </div>
        <div>
          <label htmlFor="audit-to" className="mb-1.5 block text-xs font-medium text-muted-foreground">To</label>
          <Input id="audit-to" type="date" value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} />
        </div>
        <Button type="submit">Apply</Button>
        {hasFilters && (
          <Button type="button" variant="ghost" onClick={clearFilters}>Clear</Button>
        )}
      </form>

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
            title={hasFilters ? "No matching activity" : "No audit activity yet"}
            description={
              hasFilters
                ? "Try different filters."
                : "Actions like employee changes, leave approvals and role updates will show up here."
            }
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
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>
                      <Badge variant="outline">
                        {label(log.action)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {log.entity}
                    </TableCell>
                    <TableCell className="text-foreground">
                      {log.userName ?? log.userEmail ?? "System"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDateTime(log.createdAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <DataTablePagination
              page={page}
              pageSize={PAGE_SIZE}
              total={total}
              onPageChange={setPage}
            />
          </>
        )}
      </Card>
    </div>
  );
}
