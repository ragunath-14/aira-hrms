"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

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
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Delete this employee? This cannot be undone.")) return;
    try {
      const res = await fetch(`/api/employees/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? "Failed to delete");
        return;
      }
      router.push("/employees");
    } catch {
      setError("Failed to delete employee");
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
      await load();
    } catch (err) {
      setDocError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploadingDoc(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-gray-400">Loading employee profile…</p>
      </div>
    );
  }

  if (error && !employee) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-700">
        {error}
        <div className="mt-4">
          <Link href="/employees" className="text-sm text-blue-600 hover:underline">← Back to Employees</Link>
        </div>
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
      {/* Back */}
      <Link href="/employees" className="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800">
        ← Back to Employees
      </Link>

      {/* Header card */}
      <div className="mb-6 flex flex-col gap-4 rounded-xl border bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 text-xl font-bold text-blue-700">
            {initials}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{fullName}</h1>
            <p className="text-sm text-gray-500">{employee.employeeCode}</p>
            <span className={`mt-1 inline-block rounded-full px-3 py-0.5 text-xs font-medium ${employee.status === "active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>
              {employee.status}
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          {!editing ? (
            <>
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="rounded-lg border px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
              >
                Delete
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                disabled={saving}
                onClick={handleSave}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save Changes"}
              </button>
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="rounded-lg border px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      )}

      {/* Tabs */}
      <div className="mb-4 flex flex-wrap gap-1 rounded-xl border bg-white p-1.5 shadow-sm">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setActiveTab(t.id)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${activeTab === t.id ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-100"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Overview tab */}
      {activeTab === "overview" && (
        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <h2 className="mb-5 text-lg font-semibold text-gray-900">Personal Information</h2>
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
                  <label className="mb-1 block text-xs font-medium text-gray-500">{label}</label>
                  <input
                    type={type ?? "text"}
                    value={(editForm as Record<string, string>)[key] ?? ""}
                    onChange={(e) => setEditForm({ ...editForm, [key]: e.target.value })}
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                  />
                </div>
              ))}
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">Date of Joining</label>
                <input
                  type="date"
                  value={editForm.dateOfJoining as string ?? ""}
                  onChange={(e) => setEditForm({ ...editForm, dateOfJoining: e.target.value })}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">Status</label>
                <select
                  value={editForm.status as string ?? "active"}
                  onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                  className="w-full rounded-lg border bg-white px-3 py-2 text-sm"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="terminated">Terminated</option>
                  <option value="on_leave">On Leave</option>
                </select>
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
                  <p className="text-xs text-gray-500">{label}</p>
                  <p className="mt-1 font-medium text-gray-900">{value}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Employment tab */}
      {activeTab === "employment" && (
        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <h2 className="mb-5 text-lg font-semibold text-gray-900">Employment Details</h2>
          {editing ? (
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">Department ID</label>
                <input value={editForm.departmentId as string ?? ""} onChange={(e) => setEditForm({ ...editForm, departmentId: e.target.value || null })} className="w-full rounded-lg border px-3 py-2 text-sm" placeholder="UUID" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">Designation ID</label>
                <input value={editForm.designationId as string ?? ""} onChange={(e) => setEditForm({ ...editForm, designationId: e.target.value || null })} className="w-full rounded-lg border px-3 py-2 text-sm" placeholder="UUID" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">Location ID</label>
                <input value={editForm.locationId as string ?? ""} onChange={(e) => setEditForm({ ...editForm, locationId: e.target.value || null })} className="w-full rounded-lg border px-3 py-2 text-sm" placeholder="UUID" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">Manager ID</label>
                <input value={editForm.managerId as string ?? ""} onChange={(e) => setEditForm({ ...editForm, managerId: e.target.value || null })} className="w-full rounded-lg border px-3 py-2 text-sm" placeholder="UUID" />
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
                  <p className="text-xs text-gray-500">{label}</p>
                  <p className="mt-1 font-medium text-gray-900">{value}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Attendance tab */}
      {activeTab === "attendance" && (
        <div className="rounded-xl border bg-white shadow-sm">
          <div className="border-b px-6 py-4">
            <h2 className="text-lg font-semibold text-gray-900">Attendance Records</h2>
            <p className="mt-1 text-sm text-gray-500">{employee.attendance.length} records</p>
          </div>
          {employee.attendance.length === 0 ? (
            <p className="p-8 text-center text-sm text-gray-400">No attendance records.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b bg-gray-50 text-xs text-gray-500">
                    <th className="px-6 py-3 font-medium">Date</th>
                    <th className="px-6 py-3 font-medium">Check In</th>
                    <th className="px-6 py-3 font-medium">Check Out</th>
                    <th className="px-6 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {employee.attendance.slice().reverse().map((rec) => (
                    <tr key={rec.id} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="px-6 py-3 text-sm">{rec.attendanceDate}</td>
                      <td className="px-6 py-3 text-sm text-gray-600">{rec.checkIn ? new Date(rec.checkIn).toLocaleTimeString() : "—"}</td>
                      <td className="px-6 py-3 text-sm text-gray-600">{rec.checkOut ? new Date(rec.checkOut).toLocaleTimeString() : "—"}</td>
                      <td className="px-6 py-3">
                        <StatusPill status={rec.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Leave tab */}
      {activeTab === "leave" && (
        <div className="space-y-6">
          <div className="rounded-xl border bg-white shadow-sm">
            <div className="border-b px-6 py-4">
              <h2 className="text-lg font-semibold text-gray-900">Leave Balances</h2>
            </div>
            {employee.leaveBalances.length === 0 ? (
              <p className="p-8 text-center text-sm text-gray-400">No leave balances.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b bg-gray-50 text-xs text-gray-500">
                      <th className="px-6 py-3 font-medium">Leave Type</th>
                      <th className="px-6 py-3 font-medium">Year</th>
                      <th className="px-6 py-3 font-medium">Allocated</th>
                      <th className="px-6 py-3 font-medium">Used</th>
                      <th className="px-6 py-3 font-medium">Remaining</th>
                    </tr>
                  </thead>
                  <tbody>
                    {employee.leaveBalances.map((b) => (
                      <tr key={b.id} className="border-b last:border-0">
                        <td className="px-6 py-3 text-sm font-medium text-gray-900">{b.leaveTypeName ?? "—"}</td>
                        <td className="px-6 py-3 text-sm text-gray-600">{b.year}</td>
                        <td className="px-6 py-3 text-sm">{b.allocatedDays}</td>
                        <td className="px-6 py-3 text-sm">{b.usedDays}</td>
                        <td className="px-6 py-3 text-sm font-semibold text-green-700">{b.remainingDays}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="rounded-xl border bg-white shadow-sm">
            <div className="border-b px-6 py-4">
              <h2 className="text-lg font-semibold text-gray-900">Leave Requests</h2>
            </div>
            {employee.leaveRequests.length === 0 ? (
              <p className="p-8 text-center text-sm text-gray-400">No leave requests.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b bg-gray-50 text-xs text-gray-500">
                      <th className="px-6 py-3 font-medium">Type</th>
                      <th className="px-6 py-3 font-medium">Dates</th>
                      <th className="px-6 py-3 font-medium">Days</th>
                      <th className="px-6 py-3 font-medium">Status</th>
                      <th className="px-6 py-3 font-medium">Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {employee.leaveRequests.map((lr) => (
                      <tr key={lr.id} className="border-b last:border-0">
                        <td className="px-6 py-3 text-sm font-medium text-gray-900">{lr.leaveTypeName ?? "—"}</td>
                        <td className="px-6 py-3 text-sm text-gray-600">{lr.startDate} → {lr.endDate}</td>
                        <td className="px-6 py-3 text-sm">{lr.totalDays}</td>
                        <td className="px-6 py-3"><StatusPill status={lr.status} /></td>
                        <td className="px-6 py-3 text-sm text-gray-500">{lr.reason ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Payroll tab */}
      {activeTab === "payroll" && (
        <div className="rounded-xl border bg-white shadow-sm">
          <div className="border-b px-6 py-4">
            <h2 className="text-lg font-semibold text-gray-900">Payroll Records</h2>
          </div>
          {employee.payrollRecords.length === 0 ? (
            <p className="p-8 text-center text-sm text-gray-400">No payroll records.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b bg-gray-50 text-xs text-gray-500">
                    <th className="px-6 py-3 font-medium">Period</th>
                    <th className="px-6 py-3 font-medium">Basic Salary</th>
                    <th className="px-6 py-3 font-medium">Allowances</th>
                    <th className="px-6 py-3 font-medium">Deductions</th>
                    <th className="px-6 py-3 font-medium">Net Salary</th>
                    <th className="px-6 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {employee.payrollRecords.map((pr) => (
                    <tr key={pr.id} className="border-b last:border-0">
                      <td className="px-6 py-3 text-sm font-medium text-gray-900">{pr.payrollPeriod}</td>
                      <td className="px-6 py-3 text-sm text-gray-600">₹{Number(pr.basicSalary).toLocaleString()}</td>
                      <td className="px-6 py-3 text-sm text-green-600">+₹{Number(pr.totalAllowances).toLocaleString()}</td>
                      <td className="px-6 py-3 text-sm text-red-600">-₹{Number(pr.totalDeductions).toLocaleString()}</td>
                      <td className="px-6 py-3 text-sm font-bold text-gray-900">₹{Number(pr.netSalary).toLocaleString()}</td>
                      <td className="px-6 py-3"><StatusPill status={pr.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Documents tab */}
      {activeTab === "documents" && (
        <div className="space-y-4">
          <div className="rounded-xl border bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Upload Document</h2>
            <form onSubmit={handleDocUpload} className="grid gap-4 md:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">Document Name</label>
                <input
                  value={docName}
                  onChange={(e) => setDocName(e.target.value)}
                  required
                  placeholder="e.g. ID Proof"
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">Type (optional)</label>
                <input
                  value={docType}
                  onChange={(e) => setDocType(e.target.value)}
                  placeholder="e.g. id_proof, contract"
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">File</label>
                <input
                  ref={fileRef}
                  type="file"
                  onChange={handleFileChange}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                />
              </div>
              {docError && <p className="md:col-span-3 text-sm text-red-600">{docError}</p>}
              <div className="md:col-span-3 flex justify-end">
                <button
                  type="submit"
                  disabled={uploadingDoc || !docUrl}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {uploadingDoc ? "Uploading…" : "Upload Document"}
                </button>
              </div>
            </form>
          </div>

          <div className="rounded-xl border bg-white shadow-sm">
            <div className="border-b px-6 py-4">
              <h2 className="text-lg font-semibold text-gray-900">Documents ({documents.length})</h2>
            </div>
            {documents.length === 0 ? (
              <p className="p-8 text-center text-sm text-gray-400">No documents uploaded yet.</p>
            ) : (
              <div className="divide-y">
                {documents.map((doc) => (
                  <div key={doc.id} className="flex items-center justify-between px-6 py-4">
                    <div>
                      <p className="font-medium text-gray-900">{doc.name}</p>
                      <p className="text-xs text-gray-400">{doc.type ?? "document"} · {new Date(doc.createdAt).toLocaleDateString()}</p>
                    </div>
                    <a
                      href={doc.url}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-lg border px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50"
                    >
                      View
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const colors: Record<string, string> = {
    active: "bg-green-100 text-green-700",
    inactive: "bg-gray-100 text-gray-600",
    terminated: "bg-red-100 text-red-700",
    present: "bg-green-100 text-green-700",
    absent: "bg-red-100 text-red-700",
    late: "bg-yellow-100 text-yellow-700",
    half_day: "bg-orange-100 text-orange-700",
    leave: "bg-purple-100 text-purple-700",
    holiday: "bg-blue-100 text-blue-700",
    pending: "bg-yellow-100 text-yellow-700",
    approved: "bg-green-100 text-green-700",
    rejected: "bg-red-100 text-red-700",
    processed: "bg-blue-100 text-blue-700",
    draft: "bg-gray-100 text-gray-600",
  };

  const cls = colors[status] ?? "bg-gray-100 text-gray-600";

  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}
