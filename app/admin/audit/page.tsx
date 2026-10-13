"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DownloadIcon, ScrollTextIcon } from "lucide-react";

import { authClient } from "@/lib/auth/client";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { DataTablePagination } from "@/components/shared/data-table-pagination";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { downloadCsv } from "@/lib/format/csv";
import { formatDateTime } from "@/lib/format/date";
import { errorText } from "@/lib/format/error-text";

type Row = {
  id: string;
  action: string;
  entity: string;
  createdAt: string;
  actorName: string | null;
  actorEmail: string | null;
  company: string;
};

const PAGE_SIZE = 15;

// Plain-language names for what the platform owner did.
const ACTION_LABELS: Record<string, string> = {
  company_created: "Company created",
  access_approved: "Access approved / restored",
  access_rejected: "Access suspended",
  owner_password_reset: "Owner password reset",
  owner_two_factor_reset: "Owner two-factor reset",
  login: "Signed in",
};

const label = (action: string) =>
  ACTION_LABELS[action] ?? action.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());

const selectClass =
  "h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export default function PlatformAuditPage() {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [actions, setActions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);

  const [filters, setFilters] = useState({ q: "", action: "", from: "", to: "" });
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
        const res = await fetch(`/api/admin/audit-logs?${buildQuery(page, PAGE_SIZE)}`);
        const data = await res.json();

        if (!res.ok) throw new Error(errorText(data.error, "Failed to load the audit log"));

        setRows(data.rows ?? []);
        setTotal(data.total ?? 0);
        setActions(data.actions ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load the audit log");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [page, buildQuery]);

  function apply(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    setApplied(filters);
  }

  function clear() {
    const empty = { q: "", action: "", from: "", to: "" };
    setFilters(empty);
    setApplied(empty);
    setPage(1);
  }

  async function exportCsv() {
    const res = await fetch(`/api/admin/audit-logs?${buildQuery(1, 100)}`);
    if (!res.ok) return;
    const data = await res.json();

    downloadCsv(
      `platform-audit-${new Date().toISOString().slice(0, 10)}.csv`,
      ["When", "Action", "Company", "Performed by"],
      (data.rows as Row[]).map((r) => [
        formatDateTime(r.createdAt),
        label(r.action),
        r.company,
        r.actorName ?? r.actorEmail ?? "",
      ]),
    );
  }

  async function handleLogout() {
    await authClient.signOut();
    router.push("/login");
  }

  const hasFilters = Object.values(applied).some(Boolean);

  return (
    <main className="min-h-screen bg-muted/30 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-5xl">
        <PageHeader
          title="Platform audit log"
          description="What platform administrators did: companies created, access suspended or restored, owner passwords reset and sign-ins. Activity inside a company is not shown here."
          action={
            <>
              <Button variant="outline" onClick={exportCsv} disabled={total === 0}>
                <DownloadIcon /> Export CSV
              </Button>
              <Button variant="outline" render={<Link href="/admin" />}>
                Companies
              </Button>
              <Button variant="outline" onClick={handleLogout}>
                Sign out
              </Button>
            </>
          }
        />

        <form onSubmit={apply} className="mb-4 flex flex-wrap items-end gap-3">
          <div className="min-w-48 flex-1">
            <label htmlFor="pa-q" className="mb-1.5 block text-xs font-medium text-muted-foreground">Search</label>
            <Input id="pa-q" placeholder="Person, company or action" value={filters.q} onChange={(e) => setFilters({ ...filters, q: e.target.value })} />
          </div>
          <div>
            <label htmlFor="pa-action" className="mb-1.5 block text-xs font-medium text-muted-foreground">Action</label>
            <select id="pa-action" className={selectClass} value={filters.action} onChange={(e) => setFilters({ ...filters, action: e.target.value })}>
              <option value="">All actions</option>
              {actions.map((a) => (
                <option key={a} value={a}>{label(a)}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="pa-from" className="mb-1.5 block text-xs font-medium text-muted-foreground">From</label>
            <Input id="pa-from" type="date" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} />
          </div>
          <div>
            <label htmlFor="pa-to" className="mb-1.5 block text-xs font-medium text-muted-foreground">To</label>
            <Input id="pa-to" type="date" value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} />
          </div>
          <Button type="submit">Apply</Button>
          {hasFilters && (
            <Button type="button" variant="ghost" onClick={clear}>Clear</Button>
          )}
        </form>

        {error && (
          <div className="mb-4 rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
            {error}
          </div>
        )}

        <Card className="overflow-hidden p-0">
          {loading ? (
            <div className="space-y-2 p-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            !error && (
              <EmptyState
                icon={ScrollTextIcon}
                title={hasFilters ? "No matching activity" : "No platform activity yet"}
                description={hasFilters ? "Try different filters." : "Platform actions will be recorded here."}
              />
            )
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Performed by</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {formatDateTime(r.createdAt)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{label(r.action)}</Badge>
                      </TableCell>
                      <TableCell className="text-foreground">{r.company}</TableCell>
                      <TableCell className="text-muted-foreground">
                        <div>{r.actorName ?? "—"}</div>
                        <div className="text-xs">{r.actorEmail ?? ""}</div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <DataTablePagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />
            </>
          )}
        </Card>
      </div>
    </main>
  );
}
