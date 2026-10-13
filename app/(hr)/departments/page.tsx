"use client";

import { useMemo, useState, useEffect } from "react";
import { Building2Icon, PencilIcon, PlusIcon } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import {
  DataTablePagination,
  paginate,
} from "@/components/shared/data-table-pagination";
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
import { DeleteButton } from "@/components/shared/delete-button";
import { errorText } from "@/lib/format/error-text";

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
  const [editingId, setEditingId] = useState<string | null>(null);

  async function loadDepartments() {
    try {
      setLoading(true);
      setError("");

      const response = await fetch("/api/departments");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(errorText(data.error, "Failed to fetch departments"));
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

  function openCreate() {
    setEditingId(null);
    setName("");
    setDescription("");
    setError("");
    setShowForm(true);
  }

  function openEdit(department: Department) {
    setEditingId(department.id);
    setName(department.name);
    setDescription(department.description ?? "");
    setError("");
    setShowForm(true);
  }

  async function handleSaveDepartment(
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

      const response = await fetch(
        editingId ? `/api/departments/${editingId}` : "/api/departments",
        {
        method: editingId ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
        }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          typeof data.error === "string"
            ? data.error
            : "Failed to save department",
        );
      }

      setDepartments((current) =>
        editingId
          ? current.map((d) => (d.id === editingId ? data : d))
          : [...current, data],
      );

      setName("");
      setDescription("");
      setEditingId(null);
      setShowForm(false);
      toast.success(editingId ? "Department updated" : "Department created");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to save department";
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
          <Button onClick={openCreate}>
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
                  <TableHead className="w-24"><span className="sr-only">Actions</span></TableHead>
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
                    <TableCell className="whitespace-nowrap text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Edit ${department.name}`}
                        onClick={() => openEdit(department)}
                      >
                        <PencilIcon />
                      </Button>
                      <DeleteButton
                        url={`/api/departments/${department.id}`}
                        itemName={department.name}
                        description="Employees in it are kept, but they will no longer belong to a department."
                        onDeleted={loadDepartments}
                      />
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
            <DialogTitle>{editingId ? "Edit Department" : "Add Department"}</DialogTitle>
            <DialogDescription>
              {editingId
                ? "Update this department's details."
                : "Create a new department for your organization."}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveDepartment} className="space-y-4">
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
                {saving ? "Saving…" : editingId ? "Save Changes" : "Create Department"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
