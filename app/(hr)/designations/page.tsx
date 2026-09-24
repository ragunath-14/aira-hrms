"use client";

import { useMemo, useState, useEffect } from "react";
import { BriefcaseIcon, PlusIcon } from "lucide-react";
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

type Designation = {
  id: string;
  name: string;
  description: string | null;
};

const PAGE_SIZE = 10;

export default function DesignationsPage() {
  const [designations, setDesignations] = useState<Designation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  async function loadDesignations() {
    try {
      setLoading(true);
      setError("");

      const response = await fetch("/api/designations");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch designations");
      }

      setDesignations(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to fetch designations",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDesignations();
  }, []);

  async function handleCreateDesignation(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!name.trim()) {
      setError("Designation name is required");
      return;
    }

    try {
      setSaving(true);
      setError("");

      const response = await fetch("/api/designations", {
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
        throw new Error(data.error || "Failed to create designation");
      }

      setDesignations((current) => [...current, data]);

      setName("");
      setDescription("");
      setShowForm(false);
      toast.success("Designation created");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to create designation";
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  const pagedDesignations = useMemo(
    () => paginate(designations, page, PAGE_SIZE),
    [designations, page],
  );

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Designations"
        description="Manage employee designations across your organization."
        action={
          <Button
            onClick={() => {
              setShowForm(true);
              setError("");
            }}
          >
            <PlusIcon />
            Add Designation
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
            Designation List
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {designations.length} designation
            {designations.length === 1 ? "" : "s"} found
          </p>
        </div>

        {loading ? (
          <div className="space-y-2 p-6">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className="h-12 w-full" />
            ))}
          </div>
        ) : designations.length === 0 ? (
          <EmptyState
            icon={BriefcaseIcon}
            title="No designations found"
            description="Create your first designation to get started."
          />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Designation</TableHead>
                  <TableHead>Description</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagedDesignations.map((designation) => (
                  <TableRow key={designation.id}>
                    <TableCell className="font-medium text-foreground">
                      {designation.name}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {designation.description || "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <DataTablePagination
              page={page}
              pageSize={PAGE_SIZE}
              total={designations.length}
              onPageChange={setPage}
            />
          </>
        )}
      </Card>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Designation</DialogTitle>
            <DialogDescription>
              Create a new designation for your organization.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateDesignation} className="space-y-4">
            <div>
              <Label htmlFor="designation-name" className="mb-1.5">
                Designation Name
              </Label>
              <Input
                id="designation-name"
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="e.g. HR Manager"
              />
            </div>

            <div>
              <Label htmlFor="designation-description" className="mb-1.5">
                Description
              </Label>
              <Textarea
                id="designation-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Designation description"
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
                {saving ? "Creating…" : "Create Designation"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
