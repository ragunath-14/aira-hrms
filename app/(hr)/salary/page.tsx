"use client";

import { useEffect, useMemo, useState } from "react";
import { Landmark, Layers } from "lucide-react";

import { PageHeader } from "@/components/hr/page-header";
import { StatCard } from "@/components/hr/stat-card";
import { StatusBadge } from "@/components/hr/status-badge";
import { EmptyState } from "@/components/hr/empty-state";
import {
  DataTablePagination,
  paginate,
} from "@/components/hr/data-table-pagination";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type SalaryStructure = {
  id: string;
  employeeId: string;
  basicSalary: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  status: string;
};

type SalaryComponent = {
  id: string;
  name: string;
  type: string;
  amount: string;
};

const PAGE_SIZE = 10;

export default function SalaryPage() {
  const [structures, setStructures] = useState<SalaryStructure[]>([]);
  const [components, setComponents] = useState<SalaryComponent[]>([]);
  const [loading, setLoading] = useState(true);
  const [structuresPage, setStructuresPage] = useState(1);
  const [componentsPage, setComponentsPage] = useState(1);

  useEffect(() => {
    async function loadSalaryData() {
      try {
        const [structureResponse, componentResponse] = await Promise.all([
          fetch("/api/salary-structures"),
          fetch("/api/salary-components"),
        ]);

        if (structureResponse.ok) {
          const data = await structureResponse.json();

          setStructures(Array.isArray(data) ? data : []);
        }

        if (componentResponse.ok) {
          const data = await componentResponse.json();

          setComponents(Array.isArray(data) ? data : []);
        }
      } finally {
        setLoading(false);
      }
    }

    loadSalaryData();
  }, []);

  const pagedStructures = useMemo(
    () => paginate(structures, structuresPage, PAGE_SIZE),
    [structures, structuresPage],
  );

  const pagedComponents = useMemo(
    () => paginate(components, componentsPage, PAGE_SIZE),
    [components, componentsPage],
  );

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Salary Management"
        description="Basic salary structures and salary components."
      />

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <StatCard
              label="Salary Structures"
              value={structures.length}
              icon={Landmark}
            />

            <StatCard
              label="Salary Components"
              value={components.length}
              icon={Layers}
            />
          </div>

          <Card className="mt-6 overflow-hidden p-0">
            <CardHeader className="border-b px-6 py-5">
              <CardTitle>Basic Salary</CardTitle>
            </CardHeader>

            {structures.length === 0 ? (
              <EmptyState
                icon={Landmark}
                title="No salary structures found"
                description="Salary structures will appear here once created."
              />
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Basic Salary</TableHead>
                      <TableHead>Effective From</TableHead>
                      <TableHead>Effective To</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagedStructures.map((structure) => (
                      <TableRow key={structure.id}>
                        <TableCell className="text-muted-foreground">
                          {structure.employeeId}
                        </TableCell>
                        <TableCell className="font-semibold text-foreground">
                          ₹{structure.basicSalary}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {structure.effectiveFrom}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {structure.effectiveTo || "Current"}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={structure.status} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                <DataTablePagination
                  page={structuresPage}
                  pageSize={PAGE_SIZE}
                  total={structures.length}
                  onPageChange={setStructuresPage}
                />
              </>
            )}
          </Card>

          <Card className="mt-6 overflow-hidden p-0">
            <CardHeader className="border-b px-6 py-5">
              <CardTitle>Salary Components</CardTitle>
            </CardHeader>

            {components.length === 0 ? (
              <EmptyState
                icon={Layers}
                title="No salary components found"
                description="Salary components will appear here once created."
              />
            ) : (
              <>
                <div className="grid gap-4 p-6 md:grid-cols-2 lg:grid-cols-3">
                  {pagedComponents.map((component) => (
                    <Card key={component.id}>
                      <CardContent>
                        <h3 className="font-semibold text-foreground">
                          {component.name}
                        </h3>

                        <p className="mt-2 text-sm text-muted-foreground">
                          Type: {component.type}
                        </p>

                        <p className="mt-3 text-2xl font-bold text-foreground">
                          ₹{component.amount}
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                <DataTablePagination
                  page={componentsPage}
                  pageSize={PAGE_SIZE}
                  total={components.length}
                  onPageChange={setComponentsPage}
                />
              </>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
