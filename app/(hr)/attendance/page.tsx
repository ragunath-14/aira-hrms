
"use client";

import { useEffect, useMemo, useState } from "react";

type Employee = {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string | null;
  departmentId: string | null;
};

type AttendanceRecord = {
  id: string;
  employeeId: string;
  employeeCode: string;
  firstName: string;
  lastName: string | null;
  departmentId: string | null;
  attendanceDate: string;
  checkIn: string | null;
  checkOut: string | null;
  status: string;
  notes: string | null;
};

type TodayAttendance = {
  id: string;
  employeeId: string;
  attendanceDate: string;
  checkIn: string | null;
  checkOut: string | null;
  status: string;
  notes: string | null;
};

const statuses = [
  "present",
  "absent",
  "late",
  "half_day",
  "leave",
  "holiday",
] as const;

const statusLabels: Record<string, string> = {
  present: "Present",
  absent: "Absent",
  late: "Late",
  half_day: "Half Day",
  leave: "Leave",
  holiday: "Holiday",
};

function formatName(employee: Employee) {
  return `${employee.firstName}${
    employee.lastName ? ` ${employee.lastName}` : ""
  }`;
}

function formatRecordName(record: AttendanceRecord) {
  return `${record.firstName}${
    record.lastName ? ` ${record.lastName}` : ""
  }`;
}

function formatTime(value: string | null) {
  if (!value) return "-";

  return new Date(value).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDate(value: string) {
  if (!value) return "-";

  return new Date(`${value}T00:00:00`).toLocaleDateString([], {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getStatusClasses(status: string) {
  switch (status) {
    case "present":
      return "bg-green-50 text-green-700";
    case "absent":
      return "bg-red-50 text-red-700";
    case "late":
      return "bg-yellow-50 text-yellow-700";
    case "half_day":
      return "bg-orange-50 text-orange-700";
    case "leave":
      return "bg-blue-50 text-blue-700";
    case "holiday":
      return "bg-purple-50 text-purple-700";
    default:
      return "bg-gray-100 text-gray-600";
  }
}

export default function AttendancePage() {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [today, setToday] = useState<TodayAttendance | null>(null);

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");

  const [employeeFilter, setEmployeeFilter] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [monthFilter, setMonthFilter] = useState("");

  const [editing, setEditing] = useState<AttendanceRecord | null>(null);
  const [editStatus, setEditStatus] = useState("present");
  const [editNotes, setEditNotes] = useState("");
  const [editLoading, setEditLoading] = useState(false);

  async function loadEmployees() {
    const response = await fetch("/api/employees");

    if (!response.ok) {
      throw new Error("Failed to fetch employees");
    }

    const data = await response.json();
    setEmployees(Array.isArray(data) ? data : []);
  }

  async function loadToday() {
    const response = await fetch("/api/attendance/today");

    if (response.status === 404) {
      setToday(null);
      return;
    }

    if (!response.ok) {
      throw new Error("Failed to fetch today's attendance");
    }

    const data = await response.json();
    setToday(data ?? null);
  }

  async function loadRecords() {
    const params = new URLSearchParams();

    if (employeeFilter) {
      params.set("employeeId", employeeFilter);
    }

    if (departmentFilter) {
      params.set("departmentId", departmentFilter);
    }

    if (dateFilter) {
      params.set("date", dateFilter);
    }

    if (monthFilter) {
      params.set("month", monthFilter);
    }

    const query = params.toString();

    const response = await fetch(
      `/api/attendance${query ? `?${query}` : ""}`,
    );

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      throw new Error(
        data?.error || "Failed to fetch attendance",
      );
    }

    const data = await response.json();
    setRecords(Array.isArray(data) ? data : []);
  }

  async function loadAll() {
    try {
      setLoading(true);
      setError("");

      await Promise.all([
        loadEmployees(),
        loadToday(),
        loadRecords(),
      ]);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load attendance",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  async function refreshRecords() {
    try {
      setError("");
      await Promise.all([
        loadToday(),
        loadRecords(),
      ]);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to refresh attendance",
      );
    }
  }

  async function handleCheckIn() {
    try {
      setActionLoading(true);
      setError("");

      const response = await fetch(
        "/api/attendance/check-in",
        {
          method: "POST",
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error || "Failed to check in",
        );
      }

      await refreshRecords();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to check in",
      );
    } finally {
      setActionLoading(false);
    }
  }

  async function handleCheckOut() {
    try {
      setActionLoading(true);
      setError("");

      const response = await fetch(
        "/api/attendance/check-out",
        {
          method: "POST",
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error || "Failed to check out",
        );
      }

      await refreshRecords();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to check out",
      );
    } finally {
      setActionLoading(false);
    }
  }

  function clearFilters() {
    setEmployeeFilter("");
    setDepartmentFilter("");
    setDateFilter("");
    setMonthFilter("");
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!loading) {
        loadRecords().catch((err) => {
          setError(
            err instanceof Error
              ? err.message
              : "Failed to fetch attendance",
          );
        });
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [
    employeeFilter,
    departmentFilter,
    dateFilter,
    monthFilter,
  ]);

  const summary = useMemo(() => {
    return {
      total: records.length,
      present: records.filter(
        (r) => r.status === "present",
      ).length,
      absent: records.filter(
        (r) => r.status === "absent",
      ).length,
      late: records.filter(
        (r) => r.status === "late",
      ).length,
      halfDay: records.filter(
        (r) => r.status === "half_day",
      ).length,
      leave: records.filter(
        (r) => r.status === "leave",
      ).length,
      holiday: records.filter(
        (r) => r.status === "holiday",
      ).length,
    };
  }, [records]);

  const departments = useMemo(() => {
    return Array.from(
      new Set(
        employees
          .map((employee) => employee.departmentId)
          .filter(Boolean),
      ),
    ) as string[];
  }, [employees]);

  function openEdit(record: AttendanceRecord) {
    setEditing(record);
    setEditStatus(record.status);
    setEditNotes(record.notes || "");
  }

  function closeEdit() {
    if (editLoading) return;

    setEditing(null);
    setEditStatus("present");
    setEditNotes("");
  }

  async function saveEdit() {
    if (!editing) return;

    try {
      setEditLoading(true);
      setError("");

      const response = await fetch(
        `/api/attendance/${editing.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            status: editStatus,
            notes: editNotes,
          }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error || "Failed to update attendance",
        );
      }

      closeEdit();
      await loadRecords();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to update attendance",
      );
    } finally {
      setEditLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 p-6 lg:p-8">
      <div className="mx-auto max-w-7xl">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Attendance
          </h1>

          <p className="mt-2 text-sm text-gray-500">
            Track employee attendance, check-ins and check-outs.
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Today's Attendance */}
        <section className="mb-8 rounded-xl border bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">
                Today&apos;s Attendance
              </p>

              <h2 className="mt-1 text-xl font-semibold text-gray-900">
                {today
                  ? statusLabels[today.status] || today.status
                  : "Not checked in"}
              </h2>

              <div className="mt-4 flex flex-wrap gap-6 text-sm">
                <div>
                  <p className="text-gray-400">
                    Check In
                  </p>

                  <p className="font-semibold text-gray-800">
                    {formatTime(today?.checkIn || null)}
                  </p>
                </div>

                <div>
                  <p className="text-gray-400">
                    Check Out
                  </p>

                  <p className="font-semibold text-gray-800">
                    {formatTime(today?.checkOut || null)}
                  </p>
                </div>

                <div>
                  <p className="text-gray-400">
                    Status
                  </p>

                  <span
                    className={`mt-1 inline-flex rounded-full px-3 py-1 text-xs font-medium ${getStatusClasses(
                      today?.status || "",
                    )}`}
                  >
                    {today
                      ? statusLabels[today.status] ||
                        today.status
                      : "Not Available"}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleCheckIn}
                disabled={
                  actionLoading ||
                  Boolean(today?.checkIn)
                }
                className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {actionLoading
                  ? "Processing..."
                  : "Check In"}
              </button>

              <button
                type="button"
                onClick={handleCheckOut}
                disabled={
                  actionLoading ||
                  !today?.checkIn ||
                  Boolean(today?.checkOut)
                }
                className="rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Check Out
              </button>
            </div>
          </div>
        </section>

        {/* Summary */}
        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          <SummaryCard
            title="Total"
            value={summary.total}
          />

          <SummaryCard
            title="Present"
            value={summary.present}
            tone="green"
          />

          <SummaryCard
            title="Absent"
            value={summary.absent}
            tone="red"
          />

          <SummaryCard
            title="Late"
            value={summary.late}
            tone="yellow"
          />

          <SummaryCard
            title="Half Day"
            value={summary.halfDay}
            tone="orange"
          />

          <SummaryCard
            title="Leave"
            value={summary.leave}
            tone="blue"
          />

          <SummaryCard
            title="Holiday"
            value={summary.holiday}
            tone="purple"
          />
        </div>

        {/* Filters */}
        <section className="mb-6 rounded-xl border bg-white p-6 shadow-sm">
          <div className="mb-5">
            <h2 className="text-lg font-semibold text-gray-900">
              Filters
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Filter attendance records by employee, department or date.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-gray-600">
                Employee
              </label>

              <select
                value={employeeFilter}
                onChange={(e) =>
                  setEmployeeFilter(e.target.value)
                }
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500"
              >
                <option value="">
                  All Employees
                </option>

                {employees.map((employee) => (
                  <option
                    key={employee.id}
                    value={employee.id}
                  >
                    {formatName(employee)} (
                    {employee.employeeCode})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-gray-600">
                Department
              </label>

              <select
                value={departmentFilter}
                onChange={(e) =>
                  setDepartmentFilter(e.target.value)
                }
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500"
              >
                <option value="">
                  All Departments
                </option>

                {departments.map((departmentId) => (
                  <option
                    key={departmentId}
                    value={departmentId}
                  >
                    {departmentId}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-gray-600">
                Date
              </label>

              <input
                type="date"
                value={dateFilter}
                onChange={(e) =>
                  setDateFilter(e.target.value)
                }
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-gray-600">
                Month
              </label>

              <input
                type="month"
                value={monthFilter}
                onChange={(e) =>
                  setMonthFilter(e.target.value)
                }
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500"
              />
            </div>

            <div className="flex items-end">
              <button
                type="button"
                onClick={clearFilters}
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Clear Filters
              </button>
            </div>
          </div>
        </section>

        {/* Records */}
        <section className="rounded-xl border bg-white shadow-sm">
          <div className="border-b px-6 py-5">
            <h2 className="text-lg font-semibold text-gray-900">
              Attendance Records
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              View attendance history and make authorized corrections.
            </p>
          </div>

          {loading ? (
            <div className="p-10 text-center text-sm text-gray-500">
              Loading attendance...
            </div>
          ) : records.length === 0 ? (
            <div className="p-10 text-center">
              <h3 className="font-semibold text-gray-900">
                No attendance records found
              </h3>

              <p className="mt-1 text-sm text-gray-500">
                Try changing the filters or check in to create an attendance record.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-6 py-4">
                      Employee
                    </th>

                    <th className="px-6 py-4">
                      Code
                    </th>

                    <th className="px-6 py-4">
                      Date
                    </th>

                    <th className="px-6 py-4">
                      Check In
                    </th>

                    <th className="px-6 py-4">
                      Check Out
                    </th>

                    <th className="px-6 py-4">
                      Status
                    </th>

                    <th className="px-6 py-4">
                      Notes
                    </th>

                    <th className="px-6 py-4">
                      Action
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y">
                  {records.map((record) => (
                    <tr
                      key={record.id}
                      className="hover:bg-gray-50"
                    >
                      <td className="px-6 py-4 font-medium text-gray-900">
                        {formatRecordName(record)}
                      </td>

                      <td className="px-6 py-4 text-gray-600">
                        {record.employeeCode}
                      </td>

                      <td className="px-6 py-4 text-gray-600">
                        {formatDate(record.attendanceDate)}
                      </td>

                      <td className="px-6 py-4 text-gray-600">
                        {formatTime(record.checkIn)}
                      </td>

                      <td className="px-6 py-4 text-gray-600">
                        {formatTime(record.checkOut)}
                      </td>

                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${getStatusClasses(
                            record.status,
                          )}`}
                        >
                          {statusLabels[record.status] ||
                            record.status}
                        </span>
                      </td>

                      <td className="max-w-[220px] px-6 py-4 text-gray-500">
                        {record.notes || "-"}
                      </td>

                      <td className="px-6 py-4">
                        <button
                          type="button"
                          onClick={() => openEdit(record)}
                          className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                        >
                          Correct
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {/* Correction Modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-5">
              <h2 className="text-xl font-semibold text-gray-900">
                Edit Attendance
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                Correct the attendance record where authorized.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-xs font-medium text-gray-500">
                  Employee
                </p>

                <p className="mt-1 font-medium text-gray-900">
                  {formatRecordName(editing)}
                </p>
              </div>

              <div>
                <p className="text-xs font-medium text-gray-500">
                  Date
                </p>

                <p className="mt-1 font-medium text-gray-900">
                  {formatDate(editing.attendanceDate)}
                </p>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Status
                </label>

                <select
                  value={editStatus}
                  onChange={(e) =>
                    setEditStatus(e.target.value)
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500"
                >
                  {statuses.map((status) => (
                    <option
                      key={status}
                      value={status}
                    >
                      {statusLabels[status]}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Notes
                </label>

                <textarea
                  rows={4}
                  value={editNotes}
                  onChange={(e) =>
                    setEditNotes(e.target.value)
                  }
                  placeholder="Add correction notes..."
                  className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={closeEdit}
                disabled={editLoading}
                className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={saveEdit}
                disabled={editLoading}
                className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {editLoading
                  ? "Saving..."
                  : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function SummaryCard({
  title,
  value,
  tone = "gray",
}: {
  title: string;
  value: number;
  tone?: string;
}) {
  const classes: Record<string, string> = {
    gray: "text-gray-900",
    green: "text-green-600",
    red: "text-red-600",
    yellow: "text-yellow-600",
    orange: "text-orange-600",
    blue: "text-blue-600",
    purple: "text-purple-600",
  };

  return (
    <div className="rounded-xl border bg-white p-5 shadow-sm">
      <p className="text-xs font-medium text-gray-500">
        {title}
      </p>

      <p
        className={`mt-2 text-2xl font-bold ${
          classes[tone] || classes.gray
        }`}
      >
        {value}
      </p>
    </div>
  );
}
