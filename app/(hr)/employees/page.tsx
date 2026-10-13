"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { DownloadIcon, PlusIcon, UsersIcon } from "lucide-react";
import { downloadCsv } from "@/lib/format/csv";
import { toast } from "sonner";

import { PageHeader } from "@/components/layout/page-header";
import { SearchInput } from "@/components/shared/search-input";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import {
  DataTablePagination,
  paginate,
} from "@/components/shared/data-table-pagination";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { formatDate } from "@/lib/format/date";

type Employee = {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string | null;
  email: string;
  phone: string | null;
  dateOfJoining: string | null;
  departmentId: string | null;
  designationId: string | null;
  locationId: string | null;
  managerId: string | null;
  status: string;
};

type Department = { id: string; name: string };
type Designation = { id: string; name: string };
type Location = { id: string; name: string };

const PAGE_SIZE = 10;
const NONE = "__none__";

const emptyForm = {
  employeeCode: "",
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  dateOfJoining: "",
  dateOfBirth: "",
  departmentId: NONE,
  designationId: NONE,
  locationId: NONE,
  managerId: NONE,
};

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [designations, setDesignations] = useState<Designation[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);

  async function loadLookups() {
    const [deptRes, desigRes, locRes] = await Promise.all([
      fetch("/api/departments"),
      fetch("/api/designations"),
      fetch("/api/locations"),
    ]);
    if (deptRes.ok) setDepartments(await deptRes.json());
    if (desigRes.ok) setDesignations(await desigRes.json());
    if (locRes.ok) setLocations(await locRes.json());
  }

  async function loadEmployees() {
    try {
      setLoading(true);
      setError("");
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      if (status !== "all") params.set("status", status);
      const query = params.toString();
      const response = await fetch(`/api/employees${query ? `?${query}` : ""}`);
      const data = await response.json();
      if (!response.ok) throw new Error(errorText(data.error, "Failed to fetch employees"));
      setEmployees(Array.isArray(data) ? data : []);
      setPage(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch employees");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadLookups();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => loadEmployees(), 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, status]);

  async function createEmployee(event: React.FormEvent) {
    event.preventDefault();
    try {
      setSaving(true);
      setError("");
      const response = await fetch("/api/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeCode: form.employeeCode.trim(),
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim() || null,
          email: form.email.trim(),
          phone: form.phone.trim() || null,
          dateOfJoining: form.dateOfJoining || null,
          dateOfBirth: form.dateOfBirth || null,
          departmentId: form.departmentId === NONE ? null : form.departmentId,
          designationId:
            form.designationId === NONE ? null : form.designationId,
          locationId: form.locationId === NONE ? null : form.locationId,
          managerId: form.managerId === NONE ? null : form.managerId,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(errorText(data.error, "Failed to create employee"));
      setShowAddForm(false);
      setForm(emptyForm);
      toast.success("Employee added");
      await loadEmployees();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to create employee";
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  const nameOf = (emp: Employee) =>
    `${emp.firstName}${emp.lastName ? " " + emp.lastName : ""}`;

  const pagedEmployees = useMemo(
    () => paginate(employees, page, PAGE_SIZE),
    [employees, page],
  );

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Employees"
        description="Manage your organisation's employees."
        action={
          <>
            <Button
              variant="outline"
              disabled={employees.length === 0}
              onClick={() =>
                downloadCsv(
                  `employees-${new Date().toISOString().slice(0, 10)}.csv`,
                  ["Code", "Name", "Email", "Phone", "Joined", "Status"],
                  employees.map((e) => [
                    e.employeeCode,
                    nameOf(e),
                    e.email,
                    e.phone,
                    e.dateOfJoining ? e.dateOfJoining.slice(0, 10) : "",
                    e.status,
                  ]),
                )
              }
            >
              <DownloadIcon />
              Export CSV
            </Button>
            <Button
              onClick={() => {
                setShowAddForm(true);
                setError("");
              }}
            >
              <PlusIcon />
              Add Employee
            </Button>
          </>
        }
      />

      <Card className="p-4">
        <div className="flex flex-col gap-4 md:flex-row">
          <div className="flex-1">
            <Label htmlFor="employee-search" className="mb-2">
              Search employees
            </Label>
            <SearchInput
              id="employee-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, email or employee code…"
            />
          </div>

          <div className="w-full md:w-48">
            <Label htmlFor="employee-status" className="mb-2">
              Status
            </Label>
            <Select
              value={status}
              onValueChange={(value) => setStatus(value ?? "all")}
            >
              <SelectTrigger id="employee-status" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="terminated">Terminated</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {error && (
        <div className="mt-4 rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      <Card className="mt-6 overflow-hidden p-0">
        <div className="border-b px-6 py-5">
          <h2 className="text-lg font-semibold text-foreground">
            Employee List
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {employees.length} employee{employees.length !== 1 ? "s" : ""} found
          </p>
        </div>

        {loading ? (
          <div className="space-y-2 p-6">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className="h-12 w-full" />
            ))}
          </div>
        ) : employees.length === 0 ? (
          <EmptyState
            icon={UsersIcon}
            title="No employees found"
            description="Try changing your search or status filter."
          />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Joining Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagedEmployees.map((employee) => (
                  <TableRow key={employee.id}>
                    <TableCell className="font-medium text-foreground">
                      {nameOf(employee)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {employee.employeeCode}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {employee.email}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {employee.phone ?? "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {employee.dateOfJoining
                        ? formatDate(employee.dateOfJoining)
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={employee.status} />
                    </TableCell>
                    <TableCell className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        render={<Link href={`/employees/${employee.id}`} />}
                      >
                        View Profile
                      </Button>
                      <DeleteButton
                        url={`/api/employees/${employee.id}`}
                        itemName={nameOf(employee)}
                        title={`Delete ${nameOf(employee)}?`}
                        description="This permanently removes the employee together with their attendance, leave, payroll and payslip records. Mark them inactive instead if you only want them out of day-to-day lists."
                        onDeleted={loadEmployees}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <DataTablePagination
              page={page}
              pageSize={PAGE_SIZE}
              total={employees.length}
              onPageChange={setPage}
            />
          </>
        )}
      </Card>

      <Dialog open={showAddForm} onOpenChange={setShowAddForm}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add Employee</DialogTitle>
            <DialogDescription>
              Create a new employee profile.
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={createEmployee}
            className="grid gap-4 md:grid-cols-2"
          >
            <div>
              <Label htmlFor="emp-code" className="mb-1.5">Employee Code *</Label>
              <Input
                id="emp-code"
                maxLength={30}
                required
                placeholder="EMP001"
                value={form.employeeCode}
                onChange={(e) =>
                  setForm({ ...form, employeeCode: e.target.value })
                }
              />
            </div>

            <div>
              <Label htmlFor="emp-first" className="mb-1.5">First Name *</Label>
              <Input
                id="emp-first"
                maxLength={80} autoComplete="given-name"
                required
                placeholder="First Name"
                value={form.firstName}
                onChange={(e) =>
                  setForm({ ...form, firstName: e.target.value })
                }
              />
            </div>

            <div>
              <Label htmlFor="emp-last" className="mb-1.5">Last Name</Label>
              <Input
                id="emp-last"
                maxLength={80} autoComplete="family-name"
                placeholder="Last Name"
                value={form.lastName}
                onChange={(e) =>
                  setForm({ ...form, lastName: e.target.value })
                }
              />
            </div>

            <div>
              <Label htmlFor="emp-email" className="mb-1.5">Email *</Label>
              <Input
                id="emp-email"
                maxLength={200} autoComplete="email"
                required
                type="email"
                placeholder="Email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="emp-phone" className="mb-1.5">Phone</Label>
              <Input
                id="emp-phone"
                type="tel" inputMode="tel" maxLength={20} pattern="\+?[0-9][0-9 ()\-]{6,19}" title="7 to 20 digits; spaces, +, - and brackets allowed" autoComplete="tel"
                placeholder="Phone"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="emp-join" className="mb-1.5">Date of Joining</Label>
              <Input
                id="emp-join"
                type="date"
                value={form.dateOfJoining}
                onChange={(e) =>
                  setForm({ ...form, dateOfJoining: e.target.value })
                }
              />
            </div>

            <div>
              <Label htmlFor="emp-dob" className="mb-1.5">Date of Birth</Label>
              <Input
                id="emp-dob"
                max={new Date().toISOString().slice(0, 10)}
                type="date"
                value={form.dateOfBirth}
                onChange={(e) =>
                  setForm({ ...form, dateOfBirth: e.target.value })
                }
              />
            </div>

            <div>
              <Label className="mb-1.5">Department</Label>
              <Select
                value={form.departmentId}
                onValueChange={(value) =>
                  setForm({ ...form, departmentId: value ?? NONE })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>— Select Department —</SelectItem>
                  {departments.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="mb-1.5">Designation</Label>
              <Select
                value={form.designationId}
                onValueChange={(value) =>
                  setForm({ ...form, designationId: value ?? NONE })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>— Select Designation —</SelectItem>
                  {designations.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="mb-1.5">Location</Label>
              <Select
                value={form.locationId}
                onValueChange={(value) =>
                  setForm({ ...form, locationId: value ?? NONE })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>— Select Location —</SelectItem>
                  {locations.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="mb-1.5">Manager</Label>
              <Select
                value={form.managerId}
                onValueChange={(value) =>
                  setForm({ ...form, managerId: value ?? NONE })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>— No Manager —</SelectItem>
                  {employees.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {nameOf(e)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {error && (
              <p className="text-sm text-destructive md:col-span-2">
                {error}
              </p>
            )}

            <DialogFooter className="md:col-span-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowAddForm(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : "Save Employee"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
