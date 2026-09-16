"use client";

import { useEffect, useState, useRef } from "react";

/* ─── Types ─────────────────────────────────────────────────────────── */

type EmployeeProfile = {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string | null;
  email: string;
  phone: string | null;
  dateOfJoining: string | null;
  status: string;
};

type TodayAttendance = {
  attendance: {
    id: string;
    attendanceDate: string;
    checkIn: string | null;
    checkOut: string | null;
    status: string;
  } | null;
  today: string;
};

type AttendanceRecord = {
  id: string;
  attendanceDate: string;
  checkIn: string | null;
  checkOut: string | null;
  status: string;
};

type LeaveType = { id: string; name: string; daysPerYear: number };

type LeaveBalance = {
  id: string;
  leaveTypeId: string;
  leaveType: string | null;
  year: number;
  allocatedDays: number;
  usedDays: number;
  remainingDays: number;
};

type LeaveRequest = {
  id: string;
  leaveTypeId: string;
  leaveType: string | null;
  startDate: string;
  endDate: string;
  totalDays: number;
  reason: string | null;
  status: string;
  managerComment: string | null;
  createdAt: string;
};

type Payslip = {
  id: string;
  payrollPeriod: string;
  basicSalary: string;
  totalAllowances: string;
  totalDeductions: string;
  netSalary: string;
  generatedAt: string;
};

type Notification = {
  id: string;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  createdAt: string;
};

type Document = {
  id: string;
  name: string;
  type: string | null;
  url: string;
  createdAt: string;
};

/* ─── Component ─────────────────────────────────────────────────────── */

export default function EmployeePortal() {
  const [employee, setEmployee] = useState<EmployeeProfile | null>(null);
  const [todayAttendance, setTodayAttendance] = useState<TodayAttendance | null>(null);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [leaveBalances, setLeaveBalances] = useState<LeaveBalance[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [checkinLoading, setCheckinLoading] = useState(false);
  const [checkinMsg, setCheckinMsg] = useState("");

  const [leaveTypeId, setLeaveTypeId] = useState("");
  const [leaveStart, setLeaveStart] = useState("");
  const [leaveEnd, setLeaveEnd] = useState("");
  const [leaveReason, setLeaveReason] = useState("");
  const [submittingLeave, setSubmittingLeave] = useState(false);
  const [leaveMsg, setLeaveMsg] = useState("");

  const [docName, setDocName] = useState("");
  const [docType, setDocType] = useState("");
  const [docUrl, setDocUrl] = useState("");
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [docMsg, setDocMsg] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState<"dashboard" | "attendance" | "leave" | "payslips" | "notifications" | "documents">("dashboard");

  async function loadAll() {
    try {
      setLoading(true);
      setError("");

      const [
        profileRes,
        todayRes,
        attendanceRes,
        leaveTypesRes,
        balancesRes,
        leaveRes,
        payslipRes,
        notifRes,
        docRes,
      ] = await Promise.all([
        fetch("/api/employee/profile"),
        fetch("/api/attendance/today"),
        fetch("/api/employee/attendance"),
        fetch("/api/leave-types"),
        fetch("/api/employee/leave-balances"),
        fetch("/api/employee/leave-requests"),
        fetch("/api/employee/payslips"),
        fetch("/api/employee/notifications"),
        fetch("/api/employee/documents"),
      ]);

      if (!profileRes.ok) {
        const d = await profileRes.json();
        throw new Error(d.error ?? "Failed to load profile");
      }
      setEmployee(await profileRes.json());

      if (todayRes.ok) setTodayAttendance(await todayRes.json());
      if (attendanceRes.ok) { const d = await attendanceRes.json(); setAttendance(Array.isArray(d) ? d : []); }
      if (leaveTypesRes.ok) { const d = await leaveTypesRes.json(); setLeaveTypes(Array.isArray(d) ? d : []); }
      if (balancesRes.ok) { const d = await balancesRes.json(); setLeaveBalances(Array.isArray(d) ? d : []); }
      if (leaveRes.ok) { const d = await leaveRes.json(); setLeaveRequests(Array.isArray(d) ? d : []); }
      if (payslipRes.ok) { const d = await payslipRes.json(); setPayslips(Array.isArray(d) ? d : []); }
      if (notifRes.ok) { const d = await notifRes.json(); setNotifications(Array.isArray(d) ? d : []); }
      if (docRes.ok) { const d = await docRes.json(); setDocuments(Array.isArray(d) ? d : []); }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load portal");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadAll(); }, []);

  async function handleCheckIn() {
    setCheckinLoading(true);
    setCheckinMsg("");
    try {
      const res = await fetch("/api/attendance/check-in", { method: "POST" });
      const d = await res.json();
      if (!res.ok) { setCheckinMsg(d.error ?? "Check-in failed"); }
      else { setCheckinMsg("Checked in successfully!"); await loadAll(); }
    } catch { setCheckinMsg("Check-in failed"); }
    finally { setCheckinLoading(false); }
  }

  async function handleCheckOut() {
    setCheckinLoading(true);
    setCheckinMsg("");
    try {
      const res = await fetch("/api/attendance/check-out", { method: "POST" });
      const d = await res.json();
      if (!res.ok) { setCheckinMsg(d.error ?? "Check-out failed"); }
      else { setCheckinMsg("Checked out successfully!"); await loadAll(); }
    } catch { setCheckinMsg("Check-out failed"); }
    finally { setCheckinLoading(false); }
  }

  async function handleLeaveSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!leaveTypeId || !leaveStart || !leaveEnd) { setLeaveMsg("All fields are required"); return; }
    setSubmittingLeave(true);
    setLeaveMsg("");
    try {
      const res = await fetch("/api/leave-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leaveTypeId, startDate: leaveStart, endDate: leaveEnd, reason: leaveReason }),
      });
      const d = await res.json();
      if (!res.ok) { setLeaveMsg(d.error ?? "Failed to submit leave"); }
      else {
        setLeaveMsg("Leave request submitted successfully!");
        setLeaveTypeId(""); setLeaveStart(""); setLeaveEnd(""); setLeaveReason("");
        await loadAll();
      }
    } catch { setLeaveMsg("Failed to submit leave request"); }
    finally { setSubmittingLeave(false); }
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
    if (!docName || !docUrl) { setDocMsg("Name and file are required"); return; }
    setUploadingDoc(true);
    setDocMsg("");
    try {
      const res = await fetch("/api/employee/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: docName, type: docType || null, url: docUrl }),
      });
      const d = await res.json();
      if (!res.ok) { setDocMsg(d.error ?? "Upload failed"); }
      else {
        setDocMsg("Document uploaded successfully!");
        setDocName(""); setDocType(""); setDocUrl("");
        if (fileRef.current) fileRef.current.value = "";
        await loadAll();
      }
    } catch { setDocMsg("Upload failed"); }
    finally { setUploadingDoc(false); }
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-gray-400">Loading employee portal…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-700">
        <p className="font-semibold">Error loading portal</p>
        <p className="mt-1 text-sm">{error}</p>
        <p className="mt-3 text-sm text-gray-500">Please make sure you are logged in and your account has an associated employee record.</p>
      </div>
    );
  }

  const today = todayAttendance?.attendance ?? null;
  const alreadyCheckedIn = !!today?.checkIn;
  const alreadyCheckedOut = !!today?.checkOut;
  const unread = notifications.filter((n) => !n.isRead).length;
  const pendingLeaves = leaveRequests.filter((l) => l.status === "pending").length;

  const tabs: { id: typeof activeTab; label: string }[] = [
    { id: "dashboard", label: "Dashboard" },
    { id: "attendance", label: "Attendance" },
    { id: "leave", label: "Leave" },
    { id: "payslips", label: "Payslips" },
    { id: "documents", label: "Documents" },
    { id: "notifications", label: `Notifications${unread > 0 ? ` (${unread})` : ""}` },
  ];

  return (
    <div className="mx-auto max-w-5xl">
      {/* Profile header */}
      {employee && (
        <div className="mb-6 flex items-center gap-4 rounded-xl border bg-white p-6 shadow-sm">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-100 text-lg font-bold text-blue-700">
            {employee.firstName[0]}{employee.lastName?.[0] ?? ""}
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              {employee.firstName}{employee.lastName ? " " + employee.lastName : ""}
            </h1>
            <p className="text-sm text-gray-500">{employee.employeeCode} · {employee.email}</p>
          </div>
          <div className="ml-auto">
            <span className={`rounded-full px-3 py-1 text-xs font-medium ${employee.status === "active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>
              {employee.status}
            </span>
          </div>
        </div>
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

      {/* ── Dashboard ── */}
      {activeTab === "dashboard" && (
        <div className="space-y-6">
          {/* Stats */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { label: "Attendance Records", value: attendance.length },
              { label: "Pending Leaves", value: pendingLeaves },
              { label: "Leave Balances", value: leaveBalances.length },
              { label: "Payslips", value: payslips.length },
              { label: "Documents", value: documents.length },
              { label: "Unread Notifications", value: unread },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-xl border bg-white p-5 shadow-sm">
                <p className="text-sm text-gray-500">{label}</p>
                <p className="mt-1 text-3xl font-bold text-gray-900">{value}</p>
              </div>
            ))}
          </div>

          {/* Check-In / Check-Out */}
          <div className="rounded-xl border bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Today&apos;s Attendance</h2>
            <p className="mb-4 text-sm text-gray-500">Date: <strong>{todayAttendance?.today ?? "—"}</strong></p>
            {today ? (
              <div className="mb-4 grid gap-4 sm:grid-cols-2">
                <div className="rounded-lg border bg-green-50 p-4">
                  <p className="text-xs text-gray-500">Check In</p>
                  <p className="mt-1 font-semibold text-green-700">{today.checkIn ? new Date(today.checkIn).toLocaleTimeString() : "—"}</p>
                </div>
                <div className="rounded-lg border bg-blue-50 p-4">
                  <p className="text-xs text-gray-500">Check Out</p>
                  <p className="mt-1 font-semibold text-blue-700">{today.checkOut ? new Date(today.checkOut).toLocaleTimeString() : "Not yet"}</p>
                </div>
              </div>
            ) : (
              <p className="mb-4 text-sm text-gray-400">No attendance record for today.</p>
            )}
            <div className="flex gap-3">
              {!alreadyCheckedIn && (
                <button
                  type="button"
                  disabled={checkinLoading}
                  onClick={handleCheckIn}
                  className="rounded-lg bg-green-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                >
                  {checkinLoading ? "Processing…" : "Check In"}
                </button>
              )}
              {alreadyCheckedIn && !alreadyCheckedOut && (
                <button
                  type="button"
                  disabled={checkinLoading}
                  onClick={handleCheckOut}
                  className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {checkinLoading ? "Processing…" : "Check Out"}
                </button>
              )}
              {alreadyCheckedOut && (
                <span className="rounded-lg bg-gray-100 px-5 py-2.5 text-sm font-medium text-gray-500">
                  ✓ Completed for today
                </span>
              )}
            </div>
            {checkinMsg && (
              <p className={`mt-3 text-sm ${checkinMsg.includes("failed") || checkinMsg.includes("Error") ? "text-red-600" : "text-green-600"}`}>
                {checkinMsg}
              </p>
            )}
          </div>

          {/* Apply Leave */}
          <div className="rounded-xl border bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Apply for Leave</h2>
            <form onSubmit={handleLeaveSubmit} className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">Leave Type</label>
                <select value={leaveTypeId} onChange={(e) => setLeaveTypeId(e.target.value)} required className="w-full rounded-lg border bg-white px-3 py-2.5 text-sm">
                  <option value="">— Select leave type —</option>
                  {leaveTypes.map((lt) => <option key={lt.id} value={lt.id}>{lt.name}</option>)}
                </select>
              </div>
              <div className="hidden md:block" />
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">Start Date</label>
                <input type="date" value={leaveStart} onChange={(e) => setLeaveStart(e.target.value)} required className="w-full rounded-lg border px-3 py-2.5 text-sm" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">End Date</label>
                <input type="date" value={leaveEnd} onChange={(e) => setLeaveEnd(e.target.value)} required className="w-full rounded-lg border px-3 py-2.5 text-sm" />
              </div>
              <div className="md:col-span-2">
                <label className="mb-1 block text-xs font-medium text-gray-500">Reason (optional)</label>
                <textarea value={leaveReason} onChange={(e) => setLeaveReason(e.target.value)} rows={2} placeholder="Reason for leave…" className="w-full rounded-lg border px-3 py-2.5 text-sm" />
              </div>
              {leaveMsg && (
                <p className={`md:col-span-2 text-sm ${leaveMsg.includes("failed") || leaveMsg.includes("Failed") || leaveMsg.includes("Insufficient") ? "text-red-600" : "text-green-600"}`}>
                  {leaveMsg}
                </p>
              )}
              <div className="md:col-span-2 flex justify-end">
                <button type="submit" disabled={submittingLeave} className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                  {submittingLeave ? "Submitting…" : "Submit Leave Request"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Attendance ── */}
      {activeTab === "attendance" && (
        <div className="rounded-xl border bg-white shadow-sm">
          <div className="border-b px-6 py-4">
            <h2 className="text-lg font-semibold text-gray-900">Attendance History</h2>
          </div>
          {attendance.length === 0 ? (
            <p className="p-8 text-center text-sm text-gray-400">No attendance records.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead><tr className="border-b bg-gray-50 text-xs text-gray-500">
                  <th className="px-6 py-3 font-medium">Date</th>
                  <th className="px-6 py-3 font-medium">Check In</th>
                  <th className="px-6 py-3 font-medium">Check Out</th>
                  <th className="px-6 py-3 font-medium">Status</th>
                </tr></thead>
                <tbody>
                  {attendance.map((rec) => (
                    <tr key={rec.id} className="border-b last:border-0">
                      <td className="px-6 py-3 text-sm">{rec.attendanceDate}</td>
                      <td className="px-6 py-3 text-sm text-gray-600">{rec.checkIn ? new Date(rec.checkIn).toLocaleTimeString() : "—"}</td>
                      <td className="px-6 py-3 text-sm text-gray-600">{rec.checkOut ? new Date(rec.checkOut).toLocaleTimeString() : "—"}</td>
                      <td className="px-6 py-3"><StatusPill status={rec.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Leave ── */}
      {activeTab === "leave" && (
        <div className="space-y-6">
          <div className="rounded-xl border bg-white shadow-sm">
            <div className="border-b px-6 py-4"><h2 className="text-lg font-semibold text-gray-900">My Leave Balances</h2></div>
            {leaveBalances.length === 0 ? (
              <p className="p-8 text-center text-sm text-gray-400">No leave balances found.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead><tr className="border-b bg-gray-50 text-xs text-gray-500">
                    <th className="px-6 py-3 font-medium">Type</th>
                    <th className="px-6 py-3 font-medium">Year</th>
                    <th className="px-6 py-3 font-medium">Allocated</th>
                    <th className="px-6 py-3 font-medium">Used</th>
                    <th className="px-6 py-3 font-medium">Remaining</th>
                  </tr></thead>
                  <tbody>
                    {leaveBalances.map((b) => (
                      <tr key={b.id} className="border-b last:border-0">
                        <td className="px-6 py-3 text-sm font-medium text-gray-900">{b.leaveType ?? "—"}</td>
                        <td className="px-6 py-3 text-sm text-gray-600">{b.year}</td>
                        <td className="px-6 py-3 text-sm">{b.allocatedDays}</td>
                        <td className="px-6 py-3 text-sm">{b.usedDays}</td>
                        <td className="px-6 py-3 text-sm font-bold text-green-700">{b.remainingDays}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="rounded-xl border bg-white shadow-sm">
            <div className="border-b px-6 py-4"><h2 className="text-lg font-semibold text-gray-900">My Leave Requests</h2></div>
            {leaveRequests.length === 0 ? (
              <p className="p-8 text-center text-sm text-gray-400">No leave requests.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead><tr className="border-b bg-gray-50 text-xs text-gray-500">
                    <th className="px-6 py-3 font-medium">Type</th>
                    <th className="px-6 py-3 font-medium">Dates</th>
                    <th className="px-6 py-3 font-medium">Days</th>
                    <th className="px-6 py-3 font-medium">Status</th>
                    <th className="px-6 py-3 font-medium">Comment</th>
                  </tr></thead>
                  <tbody>
                    {leaveRequests.map((lr) => (
                      <tr key={lr.id} className="border-b last:border-0">
                        <td className="px-6 py-3 text-sm font-medium">{lr.leaveType ?? "—"}</td>
                        <td className="px-6 py-3 text-sm text-gray-600">{lr.startDate} → {lr.endDate}</td>
                        <td className="px-6 py-3 text-sm">{lr.totalDays}</td>
                        <td className="px-6 py-3"><StatusPill status={lr.status} /></td>
                        <td className="px-6 py-3 text-sm text-gray-500">{lr.managerComment ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Payslips ── */}
      {activeTab === "payslips" && (
        <div className="rounded-xl border bg-white shadow-sm">
          <div className="border-b px-6 py-4"><h2 className="text-lg font-semibold text-gray-900">My Payslips</h2></div>
          {payslips.length === 0 ? (
            <p className="p-8 text-center text-sm text-gray-400">No payslips.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead><tr className="border-b bg-gray-50 text-xs text-gray-500">
                  <th className="px-6 py-3 font-medium">Period</th>
                  <th className="px-6 py-3 font-medium">Basic Salary</th>
                  <th className="px-6 py-3 font-medium">Allowances</th>
                  <th className="px-6 py-3 font-medium">Deductions</th>
                  <th className="px-6 py-3 font-medium">Net Salary</th>
                </tr></thead>
                <tbody>
                  {payslips.map((ps) => (
                    <tr key={ps.id} className="border-b last:border-0">
                      <td className="px-6 py-3 text-sm font-medium">{ps.payrollPeriod}</td>
                      <td className="px-6 py-3 text-sm text-gray-600">₹{Number(ps.basicSalary).toLocaleString()}</td>
                      <td className="px-6 py-3 text-sm text-green-600">+₹{Number(ps.totalAllowances).toLocaleString()}</td>
                      <td className="px-6 py-3 text-sm text-red-600">-₹{Number(ps.totalDeductions).toLocaleString()}</td>
                      <td className="px-6 py-3 text-sm font-bold">₹{Number(ps.netSalary).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Documents ── */}
      {activeTab === "documents" && (
        <div className="space-y-4">
          <div className="rounded-xl border bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Upload Document</h2>
            <form onSubmit={handleDocUpload} className="grid gap-4 md:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">Document Name</label>
                <input value={docName} onChange={(e) => setDocName(e.target.value)} required placeholder="e.g. Aadhaar Card" className="w-full rounded-lg border px-3 py-2.5 text-sm" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">Type (optional)</label>
                <input value={docType} onChange={(e) => setDocType(e.target.value)} placeholder="e.g. id_proof" className="w-full rounded-lg border px-3 py-2.5 text-sm" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">File</label>
                <input ref={fileRef} type="file" onChange={handleFileChange} className="w-full rounded-lg border px-3 py-2.5 text-sm" />
              </div>
              {docMsg && <p className={`md:col-span-3 text-sm ${docMsg.includes("failed") || docMsg.includes("Failed") ? "text-red-600" : "text-green-600"}`}>{docMsg}</p>}
              <div className="md:col-span-3 flex justify-end">
                <button type="submit" disabled={uploadingDoc || !docUrl} className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                  {uploadingDoc ? "Uploading…" : "Upload"}
                </button>
              </div>
            </form>
          </div>

          <div className="rounded-xl border bg-white shadow-sm">
            <div className="border-b px-6 py-4"><h2 className="text-lg font-semibold text-gray-900">My Documents ({documents.length})</h2></div>
            {documents.length === 0 ? (
              <p className="p-8 text-center text-sm text-gray-400">No documents uploaded.</p>
            ) : (
              <div className="divide-y">
                {documents.map((doc) => (
                  <div key={doc.id} className="flex items-center justify-between px-6 py-4">
                    <div>
                      <p className="font-medium text-gray-900">{doc.name}</p>
                      <p className="text-xs text-gray-400">{doc.type ?? "document"} · {new Date(doc.createdAt).toLocaleDateString()}</p>
                    </div>
                    <a href={doc.url} target="_blank" rel="noreferrer" className="rounded-lg border px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50">View</a>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Notifications ── */}
      {activeTab === "notifications" && (
        <div className="rounded-xl border bg-white shadow-sm">
          <div className="border-b px-6 py-4"><h2 className="text-lg font-semibold text-gray-900">Notifications</h2></div>
          {notifications.length === 0 ? (
            <p className="p-8 text-center text-sm text-gray-400">No notifications.</p>
          ) : (
            <div className="divide-y">
              {notifications.map((n) => (
                <div key={n.id} className={`px-6 py-4 ${!n.isRead ? "bg-blue-50" : ""}`}>
                  <div className="flex items-start justify-between">
                    <p className="font-medium text-gray-900">{n.title}</p>
                    {!n.isRead && <span className="ml-2 shrink-0 rounded-full bg-blue-500 px-2 py-0.5 text-xs font-medium text-white">New</span>}
                  </div>
                  <p className="mt-1 text-sm text-gray-600">{n.message}</p>
                  <p className="mt-1 text-xs text-gray-400">{new Date(n.createdAt).toLocaleString()}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const colors: Record<string, string> = {
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
    active: "bg-green-100 text-green-700",
    inactive: "bg-gray-100 text-gray-600",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${colors[status] ?? "bg-gray-100 text-gray-600"}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}
