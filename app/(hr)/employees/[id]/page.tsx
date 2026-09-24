"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeftIcon, FileTextIcon } from "lucide-react";
import { toast } from "sonner";

import { StatusBadge } from "@/components/hr/status-badge";
import { EmptyState } from "@/components/hr/empty-state";
import { ConfirmDialog } from "@/components/hr/confirm-dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
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
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";

type EmployeeDetail = {
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
  department: { id: string; name: string } | null;
  designation: { id: string; name: string } | null;
  location: { id: string; name: string } | null;
  attendance: AttendanceRecord[];
  leaveRequests: LeaveReqItem[];
  leaveBalances: LeaveBalItem[];
  payrollRecords: PayrollItem[];
};

type AttendanceRecord = {
  id: string;
  attendanceDate: string;
  checkIn: string | null;
  checkOut: string | null;
  status: string;
};

type LeaveReqItem = {
  id: string;
  leaveTypeName: string | null;
  startDate: string;
  endDate: string;
  totalDays: number;
  status: string;
  reason: string | null;
};

type LeaveBalItem = {
  id: string;
  leaveTypeName: string | null;
  year: number;
  allocatedDays: number;
  usedDays: number;
  remainingDays: number;
};

type PayrollItem = {
  id: string;
  payrollPeriod: string;
  basicSalary: string;
  totalAllowances: string;
  totalDeductions: string;
  netSalary: string;
  status: string;
};

type Document = {
  id: string;
  name: string;
  type: string | null;
  url: string;
  createdAt: string;
};

type Tab = "overview" | "employment" | "attendance" | "leave" | "payroll" | "documents";

export default function EmployeeProfilePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;

  const [employee, setEmployee] = useState<EmployeeDetail | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<Tab>("overview");

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState<Partial<EmployeeDetail>>({});

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [docName, setDocName] = useState("");
  const [docType, setDocType] = useState("");
  const [docUrl, setDocUrl] = useState("");
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [docError, setDocError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  async function load() {
    try {
      setLoading(true);
      setError("");

      const [empRes, docRes] = await Promise.all([
        fetch(`/api/employees/${id}`),
        fetch(`/api/employees/${id}/documents`),
      ]);

      if (!empRes.ok) {
        const d = await empRes.json();
        throw new Error(d.error ?? "Failed to load employee");
      }

      const emp: EmployeeDetail = await empRes.json();
      setEmployee(emp);
      setEditForm({
        employeeCode: emp.employeeCode,
        firstName: emp.firstName,
        lastName: emp.lastName ?? "",
        email: emp.email,
        phone: emp.phone ?? "",
        dateOfJoining: emp.dateOfJoining?.slice(0, 10) ?? "",
        departmentId: emp.departmentId ?? "",
        designationId: emp.designationId ?? "",
        locationId: emp.locationId ?? "",
        managerId: emp.managerId ?? "",
        status: emp.status,
      });

      if (docRes.ok) {
        const docs: Document[] = await docRes.json();
        setDocuments(Array.isArray(docs) ? docs : []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load employee");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function handleSave() {
    if (!employee) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/employees/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to update");
      setEditing(false);
      toast.success("Employee updated");
      await load();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update";
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/employees/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const d = await res.json();
        const message = d.error ?? "Failed to delete";
        setError(message);
        toast.error(message);
        return;
      }
      toast.success("Employee deleted");
      router.push("/employees");
    } catch {
      setError("Failed to delete employee");
      toast.error("Failed to delete employee");
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setDocUrl(reader.result as string);
      if (!docName) setDocName(file.name);
    };
    reader.readAsDataURL(file);
  }

  async function handleDocUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!docName || !docUrl) { setDocError("Name and file are required"); return; }
    setUploadingDoc(true);
    setDocError("");
    try {
      const res = await fetch(`/api/employees/${id}/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: docName, type: docType || null, url: docUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload failed");
      setDocName(""); setDocType(""); setDocUrl("");
      if (fileRef.current) fileRef.current.value = "";
      toast.success("Document uploaded");
      await load();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Upload failed";
      setDocError(message);
      toast.error(message);
    } finally {
      setUploadingDoc(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl space-y-4">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="h-10 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (error && !employee) {
    return (
      <div className="mx-auto max-w-5xl">
        <Card>
          <CardContent className="px-6 text-destructive">
            {error}
            <div className="mt-4">
              <Button variant="outline" size="sm" render={<Link href="/employees" />}>
                <ArrowLeftIcon />
                Back to Employees
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!employee) return null;

  const fullName = `${employee.firstName}${employee.lastName ? " " + employee.lastName : ""}`;
  const initials = (employee.firstName[0] + (employee.lastName?.[0] ?? "")).toUpperCase();

  const tabs: { id: Tab; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "employment", label: "Employment" },
    { id: "attendance", label: "Attendance" },
    { id: "leave", label: "Leave" },
    { id: "payroll", label: "Payroll" },
    { id: "documents", label: "Documents" },
  ];

  return (
    <div className="mx-auto max-w-5xl">
      <Link
        href="/employees"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon className="size-4" />
        Back to Employees
      </Link>

      {/* Header card */}
      <Card className="mb-6">
        <CardContent className="flex flex-col gap-4 px-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <Avatar size="lg" className="size-16">
              <AvatarFallback className="text-xl font-bold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-2xl font-bold text-foreground">{fullName}</h1>
              <p className="text-sm text-muted-foreground">{employee.employeeCode}</p>
              <div className="mt-1">
                <StatusBadge status={employee.status} />
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            {!editing ? (
              <>
                <Button variant="outline" onClick={() => setEditing(true)}>
                  Edit
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => setDeleteDialogOpen(true)}
                >
                  Delete
                </Button>
              </>
            ) : (
              <>
                <Button disabled={saving} onClick={handleSave}>
                  {saving ? "Saving…" : "Save Changes"}
                </Button>
                <Button variant="outline" onClick={() => setEditing(false)}>
                  Cancel
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {error && (
        <div className="mb-4 rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as Tab)}
      >
        <TabsList variant="line" className="mb-4">
          {tabs.map((t) => (
            <TabsTrigger key={t.id} value={t.id}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* Overview tab */}
        <TabsContent value="overview">
          <Card>
            <CardContent className="px-6">
              <h2 className="mb-5 text-lg font-semibold text-foreground">Personal Information</h2>
              {editing ? (
                <div className="grid gap-4 md:grid-cols-2">
                  {[
                    { label: "Employee Code", key: "employeeCode" },
                    { label: "First Name", key: "firstName" },
                    { label: "Last Name", key: "lastName" },
                    { label: "Email", key: "email", type: "email" },
                    { label: "Phone", key: "phone" },
                  ].map(({ label, key, type }) => (
                    <div key={key}>
                      <Label className="mb-1.5">{label}</Label>
                      <Input
                        type={type ?? "text"}
                        value={(editForm as Record<string, string>)[key] ?? ""}
                        onChange={(e) => setEditForm({ ...editForm, [key]: e.target.value })}
                      />
                    </div>
                  ))}
                  <div>
                    <Label className="mb-1.5">Date of Joining</Label>
                    <Input
                      type="date"
                      value={editForm.dateOfJoining as string ?? ""}
                      onChange={(e) => setEditForm({ ...editForm, dateOfJoining: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label className="mb-1.5">Status</Label>
                    <Select
                      value={editForm.status as string ?? "active"}
                      onValueChange={(value) =>
                        setEditForm({ ...editForm, status: value ?? "active" })
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                        <SelectItem value="terminated">Terminated</SelectItem>
                        <SelectItem value="on_leave">On Leave</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ) : (
                <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                  {[
                    { label: "Email", value: employee.email },
                    { label: "Phone", value: employee.phone ?? "—" },
                    { label: "Date of Joining", value: employee.dateOfJoining ? new Date(employee.dateOfJoining).toLocaleDateString() : "—" },
                    { label: "Department", value: employee.department?.name ?? "—" },
                    { label: "Designation", value: employee.designation?.name ?? "—" },
                    { label: "Location", value: employee.location?.name ?? "—" },
                  ].map(({ label, value }) => (
                    <div key={label}>
                      <p className="text-xs text-muted-foreground">{label}</p>
                      <p className="mt-1 font-medium text-foreground">{value}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Employment tab */}
        <TabsContent value="employment">
          <Card>
            <CardContent className="px-6">
              <h2 className="mb-5 text-lg font-semibold text-foreground">Employment Details</h2>
              {editing ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label className="mb-1.5">Department ID</Label>
                    <Input
                      value={editForm.departmentId as string ?? ""}
                      onChange={(e) => setEditForm({ ...editForm, departmentId: e.target.value || null })}
                      placeholder="UUID"
                    />
                  </div>
                  <div>
                    <Label className="mb-1.5">Designation ID</Label>
                    <Input
                      value={editForm.designationId as string ?? ""}
                      onChange={(e) => setEditForm({ ...editForm, designationId: e.target.value || null })}
                      placeholder="UUID"
                    />
                  </div>
                  <div>
                    <Label className="mb-1.5">Location ID</Label>
                    <Input
                      value={editForm.locationId as string ?? ""}
                      onChange={(e) => setEditForm({ ...editForm, locationId: e.target.value || null })}
                      placeholder="UUID"
                    />
                  </div>
                  <div>
                    <Label className="mb-1.5">Manager ID</Label>
                    <Input
                      value={editForm.managerId as string ?? ""}
                      onChange={(e) => setEditForm({ ...editForm, managerId: e.target.value || null })}
                      placeholder="UUID"
                    />
                  </div>
                </div>
              ) : (
                <div className="grid gap-5 md:grid-cols-2">
                  {[
                    { label: "Department", value: employee.department?.name ?? "Not assigned" },
                    { label: "Designation", value: employee.designation?.name ?? "Not assigned" },
                    { label: "Location", value: employee.location?.name ?? "Not assigned" },
                    { label: "Manager ID", value: employee.managerId ?? "None" },
                  ].map(({ label, value }) => (
                    <div key={label}>
                      <p className="text-xs text-muted-foreground">{label}</p>
                      <p className="mt-1 font-medium text-foreground">{value}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Attendance tab */}
        <TabsContent value="attendance">
          <Card className="overflow-hidden p-0">
            <div className="border-b px-6 py-4">
              <h2 className="text-lg font-semibold text-foreground">Attendance Records</h2>
              <p className="mt-1 text-sm text-muted-foreground">{employee.attendance.length} records</p>
            </div>
            {employee.attendance.length === 0 ? (
              <EmptyState title="No attendance records." />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Check In</TableHead>
                    <TableHead>Check Out</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {employee.attendance.slice().reverse().map((rec) => (
                    <TableRow key={rec.id}>
                      <TableCell>{rec.attendanceDate}</TableCell>
                      <TableCell className="text-muted-foreground">{rec.checkIn ? new Date(rec.checkIn).toLocaleTimeString() : "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{rec.checkOut ? new Date(rec.checkOut).toLocaleTimeString() : "—"}</TableCell>
                      <TableCell>
                        <StatusBadge status={rec.status} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        </TabsContent>

        {/* Leave tab */}
        <TabsContent value="leave" className="space-y-6">
          <Card className="overflow-hidden p-0">
            <div className="border-b px-6 py-4">
              <h2 className="text-lg font-semibold text-foreground">Leave Balances</h2>
            </div>
            {employee.leaveBalances.length === 0 ? (
              <EmptyState title="No leave balances." />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Leave Type</TableHead>
                    <TableHead>Year</TableHead>
                    <TableHead>Allocated</TableHead>
                    <TableHead>Used</TableHead>
                    <TableHead>Remaining</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {employee.leaveBalances.map((b) => (
                    <TableRow key={b.id}>
                      <TableCell className="font-medium text-foreground">{b.leaveTypeName ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{b.year}</TableCell>
                      <TableCell>{b.allocatedDays}</TableCell>
                      <TableCell>{b.usedDays}</TableCell>
                      <TableCell className="font-semibold text-foreground">{b.remainingDays}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>

          <Card className="overflow-hidden p-0">
            <div className="border-b px-6 py-4">
              <h2 className="text-lg font-semibold text-foreground">Leave Requests</h2>
            </div>
            {employee.leaveRequests.length === 0 ? (
              <EmptyState title="No leave requests." />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Dates</TableHead>
                    <TableHead>Days</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Reason</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {employee.leaveRequests.map((lr) => (
                    <TableRow key={lr.id}>
                      <TableCell className="font-medium text-foreground">{lr.leaveTypeName ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{lr.startDate} → {lr.endDate}</TableCell>
                      <TableCell>{lr.totalDays}</TableCell>
                      <TableCell><StatusBadge status={lr.status} /></TableCell>
                      <TableCell className="text-muted-foreground">{lr.reason ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        </TabsContent>

        {/* Payroll tab */}
        <TabsContent value="payroll">
          <Card className="overflow-hidden p-0">
            <div className="border-b px-6 py-4">
              <h2 className="text-lg font-semibold text-foreground">Payroll Records</h2>
            </div>
            {employee.payrollRecords.length === 0 ? (
              <EmptyState title="No payroll records." />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Period</TableHead>
                    <TableHead>Basic Salary</TableHead>
                    <TableHead>Allowances</TableHead>
                    <TableHead>Deductions</TableHead>
                    <TableHead>Net Salary</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {employee.payrollRecords.map((pr) => (
                    <TableRow key={pr.id}>
                      <TableCell className="font-medium text-foreground">{pr.payrollPeriod}</TableCell>
                      <TableCell className="text-muted-foreground">₹{Number(pr.basicSalary).toLocaleString()}</TableCell>
                      <TableCell className="text-emerald-600 dark:text-emerald-400">+₹{Number(pr.totalAllowances).toLocaleString()}</TableCell>
                      <TableCell className="text-destructive">-₹{Number(pr.totalDeductions).toLocaleString()}</TableCell>
                      <TableCell className="font-bold text-foreground">₹{Number(pr.netSalary).toLocaleString()}</TableCell>
                      <TableCell><StatusBadge status={pr.status} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        </TabsContent>

        {/* Documents tab */}
        <TabsContent value="documents" className="space-y-4">
          <Card>
            <CardContent className="px-6">
              <h2 className="mb-4 text-lg font-semibold text-foreground">Upload Document</h2>
              <form onSubmit={handleDocUpload} className="grid gap-4 md:grid-cols-3">
                <div>
                  <Label className="mb-1.5">Document Name</Label>
                  <Input
                    value={docName}
                    onChange={(e) => setDocName(e.target.value)}
                    required
                    placeholder="e.g. ID Proof"
                  />
                </div>
                <div>
                  <Label className="mb-1.5">Type (optional)</Label>
                  <Input
                    value={docType}
                    onChange={(e) => setDocType(e.target.value)}
                    placeholder="e.g. id_proof, contract"
                  />
                </div>
                <div>
                  <Label className="mb-1.5">File</Label>
                  <Input
                    ref={fileRef}
                    type="file"
                    onChange={handleFileChange}
                  />
                </div>
                {docError && <p className="text-sm text-destructive md:col-span-3">{docError}</p>}
                <div className="flex justify-end md:col-span-3">
                  <Button type="submit" disabled={uploadingDoc || !docUrl}>
                    {uploadingDoc ? "Uploading…" : "Upload Document"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card className="overflow-hidden p-0">
            <div className="border-b px-6 py-4">
              <h2 className="text-lg font-semibold text-foreground">Documents ({documents.length})</h2>
            </div>
            {documents.length === 0 ? (
              <EmptyState icon={FileTextIcon} title="No documents uploaded yet." />
            ) : (
              <div className="divide-y">
                {documents.map((doc) => (
                  <div key={doc.id} className="flex items-center justify-between px-6 py-4">
                    <div>
                      <p className="font-medium text-foreground">{doc.name}</p>
                      <p className="text-xs text-muted-foreground">{doc.type ?? "document"} · {new Date(doc.createdAt).toLocaleDateString()}</p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      render={<a href={doc.url} target="_blank" rel="noreferrer" />}
                    >
                      View
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete this employee?"
        description="This cannot be undone."
        confirmLabel="Delete"
        loading={deleting}
        onConfirm={handleDelete}
      />
    </div>
  );
}
