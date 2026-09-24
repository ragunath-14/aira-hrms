"use client";

import { useEffect, useMemo, useState } from "react";
import { Building2Icon } from "lucide-react";

import { PageHeader } from "@/components/hr/page-header";
import { EmptyState } from "@/components/hr/empty-state";
import {
  DataTablePagination,
  paginate,
} from "@/components/hr/data-table-pagination";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Tenant = {
  id: string;
  name: string;
  slug: string;
  email: string | null;
  createdAt: string;
  memberCount: number;
};

const PAGE_SIZE = 10;

export default function AdminPage() {
  const [tenants, setTenants] = useState<Tenant[] | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  useEffect(() => {
    async function load() {
      try {
        const response = await fetch("/api/admin/tenants");
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Access denied");
        }

        setTenants(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Access denied");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  const pagedTenants = useMemo(
    () => paginate(tenants ?? [], page, PAGE_SIZE),
    [tenants, page],
  );

  return (
    <main className="min-h-screen bg-muted/30 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-5xl">
        <PageHeader
          title="Platform Admin"
          description="All tenants on this deployment."
        />

        {error && !loading && (
          <div className="mb-4 rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
            {error}
          </div>
        )}

        <Card className="overflow-hidden p-0">
          {loading ? (
            <div className="space-y-2 p-6">
              {Array.from({ length: 5 }).map((_, index) => (
                <Skeleton key={index} className="h-12 w-full" />
              ))}
            </div>
          ) : !tenants || tenants.length === 0 ? (
            !error && (
              <EmptyState
                icon={Building2Icon}
                title="No tenants found"
                description="No tenants have been created on this deployment yet."
              />
            )
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tenant</TableHead>
                    <TableHead>Slug</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Members</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagedTenants.map((tenant) => (
                    <TableRow key={tenant.id}>
                      <TableCell className="font-medium text-foreground">
                        {tenant.name}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {tenant.slug}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {tenant.email ?? "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {tenant.memberCount}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(tenant.createdAt).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <DataTablePagination
                page={page}
                pageSize={PAGE_SIZE}
                total={tenants.length}
                onPageChange={setPage}
              />
            </>
          )}
        </Card>
      </div>
    </main>
  );
}
