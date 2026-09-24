"use client";

import { useMemo, useState, useEffect } from "react";
import { Building2Icon, PlusIcon } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/hr/page-header";
import { EmptyState } from "@/components/hr/empty-state";
import {
  DataTablePagination,
  paginate,
} from "@/components/hr/data-table-pagination";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Department = {
  id: string;
  name: string;
  description: string | null;
};

const PAGE_SIZE = 10;

export default function DepartmentsPage() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  async function loadDepartments() {
    try {
      setLoading(true);
      setError("");

      const response = await fetch("/api/departments");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch departments");
      }

      setDepartments(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to fetch departments",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDepartments();
  }, []);

  async function handleCreateDepartment(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!name.trim()) {
      setError("Department name is required");
      return;
    }

    try {
      setSaving(true);
      setError("");

      const response = await fetch("/api/departments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create department");
      }

      setDepartments((current) => [...current, data]);

      setName("");
      setDescription("");
      setShowForm(false);
      toast.success("Department created");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to create department";
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  const pagedDepartments = useMemo(
    () => paginate(departments, page, PAGE_SIZE),
    [departments, page],
  );

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Departments"
        description="Manage departments across your organization."
        action={
          <Button
            onClick={() => {
              setShowForm(true);
              setError("");
            }}
          >
            <PlusIcon />
            Add Department
          </Button>
        }
      />

      {error && (
        <div className="mb-4 rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      <Card className="overflow-hidden p-0">
        <div className="border-b px-6 py-5">
          <h2 className="text-lg font-semibold text-foreground">
            Department List
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {departments.length} department
            {departments.length === 1 ? "" : "s"} found
          </p>
        </div>

        {loading ? (
          <div className="space-y-2 p-6">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className="h-12 w-full" />
            ))}
          </div>
        ) : departments.length === 0 ? (
          <EmptyState
            icon={Building2Icon}
            title="No departments found"
            description="Create your first department to get started."
          />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Department</TableHead>
                  <TableHead>Description</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagedDepartments.map((department) => (
                  <TableRow key={department.id}>
                    <TableCell className="font-medium text-foreground">
                      {department.name}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {department.description || "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <DataTablePagination
              page={page}
              pageSize={PAGE_SIZE}
              total={departments.length}
              onPageChange={setPage}
            />
          </>
        )}
      </Card>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Department</DialogTitle>
            <DialogDescription>
              Create a new department for your organization.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateDepartment} className="space-y-4">
            <div>
              <Label htmlFor="department-name" className="mb-1.5">
                Department Name
              </Label>
              <Input
                id="department-name"
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="e.g. Human Resources"
              />
            </div>

            <div>
              <Label htmlFor="department-description" className="mb-1.5">
                Description
              </Label>
              <Textarea
                id="department-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Department description"
                rows={4}
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowForm(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Creating…" : "Create Department"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
