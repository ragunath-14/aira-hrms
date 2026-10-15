"use client";

import { useEffect, useMemo, useState } from "react";
import { Landmark, Layers, PlusIcon } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import {
  DataTablePagination,
  paginate,
} from "@/components/shared/data-table-pagination";
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
import { formatINR } from "@/lib/format/currency";
import { apiError, selectClass } from "@/components/shared/ui-bits";
import { useIsHr } from "@/hooks/use-is-hr";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DeleteButton } from "@/components/shared/delete-button";

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
  employeeId: string | null;
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

  const [names, setNames] = useState<Record<string, string>>({});
  const [employeeList, setEmployeeList] = useState<
    { id: string; label: string }[]
  >([]);
  const isHr = useIsHr();

  const [structureOpen, setStructureOpen] = useState(false);
  const [componentOpen, setComponentOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [structureForm, setStructureForm] = useState({
    employeeId: "",
    basicSalary: "",
    effectiveFrom: new Date().toISOString().slice(0, 10),
  });
  const [componentForm, setComponentForm] = useState({
    name: "",
    type: "allowance",
    amount: "",
    employeeId: "",
  });

  async function loadSalaryData() {
      try {
        const [structureResponse, componentResponse, employeeResponse] =
          await Promise.all([
            fetch("/api/salary-structures"),
            fetch("/api/salary-components"),
            fetch("/api/employees"),
          ]);

        if (employeeResponse.ok) {
          const list = await employeeResponse.json();

          if (Array.isArray(list)) {
            setEmployeeList(
              list.map(
                (e: {
                  id: string;
                  firstName: string;
                  lastName: string | null;
                  employeeCode: string;
                }) => ({
                  id: e.id,
                  label: `${e.firstName}${e.lastName ? ` ${e.lastName}` : ""} (${e.employeeCode})`,
                }),
              ),
            );
            setNames(
              Object.fromEntries(
                list.map(
                  (e: {
                    id: string;
                    firstName: string;
                    lastName: string | null;
                    employeeCode: string;
                  }) => [
                    e.id,
                    `${e.firstName}${e.lastName ? ` ${e.lastName}` : ""} (${e.employeeCode})`,
                  ],
                ),
              ),
            );
          }
        }

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

  useEffect(() => {
    loadSalaryData();
  }, []);

  async function createStructure(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    try {
      const res = await fetch("/api/salary-structures", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: structureForm.employeeId,
          basicSalary: Number(structureForm.basicSalary),
          effectiveFrom: structureForm.effectiveFrom,
        }),
      });

      if (!res.ok) throw new Error(await apiError(res, "Failed to add salary structure"));

      toast.success("Salary structure added");
      setStructureOpen(false);
      setStructureForm({ ...structureForm, basicSalary: "" });
      loadSalaryData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add salary structure");
    } finally {
      setSaving(false);
    }
  }

  async function createComponent(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    try {
      const res = await fetch("/api/salary-components", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: componentForm.name,
          type: componentForm.type,
          amount: Number(componentForm.amount),
          employeeId: componentForm.employeeId || null,
        }),
      });

      if (!res.ok) throw new Error(await apiError(res, "Failed to add salary component"));

      toast.success("Salary component added");
      setComponentOpen(false);
      setComponentForm({ ...componentForm, name: "", amount: "" });
      loadSalaryData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add salary component");
    } finally {
      setSaving(false);
    }
  }

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
        action={
          isHr ? (
            <>
              <Button
                variant="outline"
                onClick={() => {
                  setStructureForm((f) => ({ ...f, employeeId: f.employeeId || employeeList[0]?.id || "" }));
                  setStructureOpen(true);
                }}
              >
                <PlusIcon /> Add Structure
              </Button>
              <Button onClick={() => setComponentOpen(true)}>
                <PlusIcon /> Add Component
              </Button>
            </>
          ) : undefined
        }
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
                      <TableHead className="w-12"><span className="sr-only">Actions</span></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagedStructures.map((structure) => (
                      <TableRow key={structure.id}>
                        <TableCell className="text-muted-foreground">
                          {names[structure.employeeId] ?? structure.employeeId}
                        </TableCell>
                        <TableCell className="font-semibold text-foreground">
                          {formatINR(structure.basicSalary)}
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
                        <TableCell className="text-right">
                          <DeleteButton
                            url={`/api/salary-structures/${structure.id}`}
                            itemName="salary structure"
                            description="Existing payslips and payroll records are not changed."
                            onDeleted={loadSalaryData}
                          />
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
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="font-semibold text-foreground">
                            {component.name}
                          </h3>
                          <DeleteButton
                            url={`/api/salary-components/${component.id}`}
                            itemName={component.name}
                            onDeleted={loadSalaryData}
                          />
                        </div>

                        <p className="mt-2 text-sm text-muted-foreground">
                          Type: {component.type} ·{" "}
                          {component.employeeId ? names[component.employeeId] ?? "One employee" : "Everyone"}
                        </p>

                        <p className="mt-3 text-2xl font-bold text-foreground">
                          {formatINR(component.amount)}
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

      <Dialog open={structureOpen} onOpenChange={setStructureOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Salary Structure</DialogTitle>
            <DialogDescription>Set an employee&apos;s basic monthly salary.</DialogDescription>
          </DialogHeader>

          <form onSubmit={createStructure} className="space-y-4">
            <div>
              <Label htmlFor="structure-employee" className="mb-1.5">Employee</Label>
              <select
                id="structure-employee"
                required
                className={selectClass}
                value={structureForm.employeeId}
                onChange={(e) => setStructureForm({ ...structureForm, employeeId: e.target.value })}
              >
                {employeeList.map((e) => (
                  <option key={e.id} value={e.id}>{e.label}</option>
                ))}
              </select>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="structure-basic" className="mb-1.5">Basic salary (₹)</Label>
                <Input
                  id="structure-basic"
                  type="number"
                  min="1"
                  step="0.01"
                  required
                  value={structureForm.basicSalary}
                  onChange={(e) => setStructureForm({ ...structureForm, basicSalary: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="structure-from" className="mb-1.5">Effective from</Label>
                <Input
                  id="structure-from"
                  type="date"
                  required
                  value={structureForm.effectiveFrom}
                  onChange={(e) => setStructureForm({ ...structureForm, effectiveFrom: e.target.value })}
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setStructureOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? "Adding…" : "Add structure"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={componentOpen} onOpenChange={setComponentOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Salary Component</DialogTitle>
            <DialogDescription>An allowance or deduction such as HRA. It applies to everyone, or to one employee only.</DialogDescription>
          </DialogHeader>

          <form onSubmit={createComponent} className="space-y-4">
            <div>
              <Label htmlFor="component-name" className="mb-1.5">Name</Label>
              <Input
                id="component-name"
                required
                value={componentForm.name}
                onChange={(e) => setComponentForm({ ...componentForm, name: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="component-employee" className="mb-1.5">Applies to</Label>
              <select
                id="component-employee"
                className={selectClass}
                value={componentForm.employeeId}
                onChange={(e) => setComponentForm({ ...componentForm, employeeId: e.target.value })}
              >
                <option value="">Everyone in the company</option>
                {employeeList.map((e) => (
                  <option key={e.id} value={e.id}>{e.label}</option>
                ))}
              </select>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="component-type" className="mb-1.5">Type</Label>
                <select
                  id="component-type"
                  className={selectClass}
                  value={componentForm.type}
                  onChange={(e) => setComponentForm({ ...componentForm, type: e.target.value })}
                >
                  <option value="allowance">Allowance</option>
                  <option value="deduction">Deduction</option>
                </select>
              </div>
              <div>
                <Label htmlFor="component-amount" className="mb-1.5">Amount (₹)</Label>
                <Input
                  id="component-amount"
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={componentForm.amount}
                  onChange={(e) => setComponentForm({ ...componentForm, amount: e.target.value })}
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setComponentOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? "Adding…" : "Add component"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
