"use client";

import { useEffect, useMemo, useState } from "react";

type Employee = {
  id: string;
  firstName: string;
  lastName: string | null;
  employeeCode: string;
  managerId: string | null;
};

type LeaveType = {
  id: string;
  name: string;
  description: string | null;
  daysPerYear: number;
  isActive: string;
};

type LeaveBalance = {
  id: string;
  employeeId: string;
  leaveTypeId: string;
  leaveType: string;
  year: number;
  allocatedDays: number;
  usedDays: number;
  remainingDays: number;
};

type LeaveRequest = {
  id: string;
  employeeId: string;
  leaveTypeId: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  reason: string | null;
  status: string;
  managerComment: string | null;
  createdAt: string;
};

export default function LeaveManagementPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [requests, setRequests] = useState<LeaveRequest[]>([]);

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [activeTab, setActiveTab] = useState<
    "requests" | "balances" | "types"
  >("requests");

  const [statusFilter, setStatusFilter] = useState("pending");
  const [employeeFilter, setEmployeeFilter] = useState("");

  const [showTypeForm, setShowTypeForm] = useState(false);
  const [typeName, setTypeName] = useState("");
  const [typeDescription, setTypeDescription] = useState("");
  const [typeDays, setTypeDays] = useState("12");

  const [commentRequestId, setCommentRequestId] = useState("");
  const [managerComment, setManagerComment] = useState("");

  async function loadEmployees() {
    const response = await fetch("/api/employees");

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Failed to fetch employees");
    }

    setEmployees(Array.isArray(data) ? data : []);
    return Array.isArray(data) ? data : [];
  }

  async function loadLeaveTypes() {
    const response = await fetch("/api/leave-types");

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Failed to fetch leave types");
    }

    setLeaveTypes(Array.isArray(data) ? data : []);
  }

  async function loadBalances(employeeList: Employee[]) {
    const results: LeaveBalance[] = [];

    for (const employee of employeeList) {
      try {
        const response = await fetch(
          `/api/leave-balances?employeeId=${employee.id}`,
        );

        if (!response.ok) {
          continue;
        }

        const data = await response.json();

        if (Array.isArray(data)) {
          results.push(...data);
        }
      } catch {
        // Ignore individual employee balance failures.
      }
    }

    setBalances(results);
  }

  async function loadRequests(employeeList: Employee[]) {
    const results: LeaveRequest[] = [];

    for (const employee of employeeList) {
      try {
        const response = await fetch(
          `/api/leave-requests?employeeId=${employee.id}`,
        );

        if (!response.ok) {
          continue;
        }

        const data = await response.json();

        if (Array.isArray(data)) {
          results.push(...data);
        }
      } catch {
        // Ignore individual employee request failures.
      }
    }

    setRequests(results);
  }

  async function loadData() {
    try {
      setLoading(true);
      setError("");

      const employeeList = await loadEmployees();

      await Promise.all([
        loadLeaveTypes(),
        loadBalances(employeeList),
        loadRequests(employeeList),
      ]);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load leave management data",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  function employeeName(employeeId: string) {
    const employee = employees.find(
      (item) => item.id === employeeId,
    );

    if (!employee) {
      return "Unknown employee";
    }

    return `${employee.firstName}${
      employee.lastName ? ` ${employee.lastName}` : ""
    }`;
  }

  async function processRequest(
    requestId: string,
    action: "approve" | "reject",
  ) {
    try {
      setActionLoading(requestId);
      setError("");
      setSuccess("");

      const response = await fetch(
        `/api/leave-requests/${requestId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action,
            comment:
              commentRequestId === requestId
                ? managerComment
                : "",
          }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Failed to process leave request",
        );
      }

      setSuccess(
        action === "approve"
          ? "Leave request approved successfully."
          : "Leave request rejected successfully.",
      );

      setCommentRequestId("");
      setManagerComment("");

      await loadData();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to process leave request",
      );
    } finally {
      setActionLoading("");
    }
  }

  async function createLeaveType(
    event: React.FormEvent,
  ) {
    event.preventDefault();

    try {
      setActionLoading("leave-type");
      setError("");
      setSuccess("");

      const response = await fetch("/api/leave-types", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: typeName.trim(),
          description: typeDescription.trim(),
          daysPerYear: Number(typeDays),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Failed to create leave type",
        );
      }

      setSuccess("Leave type created successfully.");
      setShowTypeForm(false);
      setTypeName("");
      setTypeDescription("");
      setTypeDays("12");

      await loadLeaveTypes();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to create leave type",
      );
    } finally {
      setActionLoading("");
    }
  }

  const filteredRequests = useMemo(() => {
    return requests
      .filter((request) =>
        statusFilter
          ? request.status === statusFilter
          : true,
      )
      .filter((request) =>
        employeeFilter
          ? request.employeeId === employeeFilter
          : true,
      )
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() -
          new Date(a.createdAt).getTime(),
      );
  }, [
    requests,
    statusFilter,
    employeeFilter,
  ]);

  const pendingCount = requests.filter(
    (request) => request.status === "pending",
  ).length;

  const approvedCount = requests.filter(
    (request) => request.status === "approved",
  ).length;

  const rejectedCount = requests.filter(
    (request) => request.status === "rejected",
  ).length;

  const totalRemainingDays = balances.reduce(
    (total, balance) =>
      total + balance.remainingDays,
    0,
  );

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Leave Management
            </h1>

            <p className="mt-2 text-gray-500">
              Manage leave types, employee balances and leave requests.
            </p>
          </div>

          {activeTab === "types" && (
            <button
              type="button"
              onClick={() =>
                setShowTypeForm((value) => !value)
              }
              className="rounded-lg bg-gray-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-gray-800"
            >
              {showTypeForm
                ? "Cancel"
                : "Add Leave Type"}
            </button>
          )}
        </div>

        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-6 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-700">
            {success}
          </div>
        )}

        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard
            title="Pending Requests"
            value={pendingCount}
          />

          <SummaryCard
            title="Approved"
            value={approvedCount}
          />

          <SummaryCard
            title="Rejected"
            value={rejectedCount}
          />

          <SummaryCard
            title="Remaining Leave Days"
            value={totalRemainingDays}
          />
        </div>

        <div className="mb-6 flex flex-wrap gap-2 rounded-xl border bg-white p-2 shadow-sm">
          <TabButton
            active={activeTab === "requests"}
            onClick={() => setActiveTab("requests")}
          >
            Leave Requests
          </TabButton>

          <TabButton
            active={activeTab === "balances"}
            onClick={() => setActiveTab("balances")}
          >
            Leave Balances
          </TabButton>

          <TabButton
            active={activeTab === "types"}
            onClick={() => setActiveTab("types")}
          >
            Leave Types
          </TabButton>
        </div>

        {loading ? (
          <div className="rounded-xl border bg-white p-10 text-center shadow-sm">
            <p className="text-sm text-gray-500">
              Loading leave management...
            </p>
          </div>
        ) : (
          <>
            {activeTab === "requests" && (
              <section className="overflow-hidden rounded-xl border bg-white shadow-sm">
                <div className="border-b px-6 py-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                      <h2 className="text-xl font-semibold text-gray-900">
                        Leave Requests
                      </h2>

                      <p className="mt-1 text-sm text-gray-500">
                        Review and process employee leave applications.
                      </p>
                    </div>

                    <div className="flex flex-col gap-3 sm:flex-row">
                      <select
                        value={statusFilter}
                        onChange={(event) =>
                          setStatusFilter(
                            event.target.value,
                          )
                        }
                        className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm outline-none"
                      >
                        <option value="">
                          All Statuses
                        </option>
                        <option value="pending">
                          Pending
                        </option>
                        <option value="approved">
                          Approved
                        </option>
                        <option value="rejected">
                          Rejected
                        </option>
                      </select>

                      <select
                        value={employeeFilter}
                        onChange={(event) =>
                          setEmployeeFilter(
                            event.target.value,
                          )
                        }
                        className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm outline-none"
                      >
                        <option value="">
                          All Employees
                        </option>

                        {employees.map((employee) => (
                          <option
                            key={employee.id}
                            value={employee.id}
                          >
                            {employeeName(employee.id)}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {filteredRequests.length === 0 ? (
                  <div className="p-10 text-center">
                    <h3 className="text-lg font-semibold text-gray-900">
                      No leave requests found
                    </h3>

                    <p className="mt-2 text-sm text-gray-500">
                      There are no requests matching the selected filters.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="border-b bg-gray-50 text-sm text-gray-500">
                          <th className="px-6 py-4 font-medium">
                            Employee
                          </th>

                          <th className="px-6 py-4 font-medium">
                            Leave Type
                          </th>

                          <th className="px-6 py-4 font-medium">
                            Dates
                          </th>

                          <th className="px-6 py-4 font-medium">
                            Days
                          </th>

                          <th className="px-6 py-4 font-medium">
                            Reason
                          </th>

                          <th className="px-6 py-4 font-medium">
                            Status
                          </th>

                          <th className="px-6 py-4 font-medium">
                            Action
                          </th>
                        </tr>
                      </thead>

                      <tbody>
                        {filteredRequests.map(
                          (request) => (
                            <tr
                              key={request.id}
                              className="border-b last:border-0"
                            >
                              <td className="px-6 py-4">
                                <div className="font-medium text-gray-900">
                                  {employeeName(
                                    request.employeeId,
                                  )}
                                </div>

                                <div className="mt-1 text-xs text-gray-500">
                                  {
                                    employees.find(
                                      (employee) =>
                                        employee.id ===
                                        request.employeeId,
                                    )?.employeeCode
                                  }
                                </div>
                              </td>

                              <td className="px-6 py-4 text-sm text-gray-700">
                                {request.leaveType}
                              </td>

                              <td className="px-6 py-4 text-sm text-gray-600">
                                {request.startDate} →{" "}
                                {request.endDate}
                              </td>

                              <td className="px-6 py-4 text-sm font-medium text-gray-900">
                                {request.totalDays}
                              </td>

                              <td className="max-w-xs px-6 py-4 text-sm text-gray-600">
                                {request.reason || "—"}
                              </td>

                              <td className="px-6 py-4">
                                <StatusBadge
                                  status={request.status}
                                />
                              </td>

                              <td className="px-6 py-4">
                                {request.status ===
                                "pending" ? (
                                  <div className="flex min-w-[180px] flex-col gap-2">
                                    {commentRequestId ===
                                      request.id && (
                                      <textarea
                                        value={
                                          managerComment
                                        }
                                        onChange={(event) =>
                                          setManagerComment(
                                            event.target
                                              .value,
                                          )
                                        }
                                        placeholder="Optional manager comment..."
                                        rows={2}
                                        className="rounded-lg border border-gray-300 px-3 py-2 text-xs outline-none focus:border-gray-500"
                                      />
                                    )}

                                    <div className="flex gap-2">
                                      <button
                                        type="button"
                                        disabled={
                                          actionLoading ===
                                          request.id
                                        }
                                        onClick={() =>
                                          processRequest(
                                            request.id,
                                            "approve",
                                          )
                                        }
                                        className="rounded-lg bg-green-600 px-3 py-2 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
                                      >
                                        Approve
                                      </button>

                                      <button
                                        type="button"
                                        disabled={
                                          actionLoading ===
                                          request.id
                                        }
                                        onClick={() =>
                                          processRequest(
                                            request.id,
                                            "reject",
                                          )
                                        }
                                        className="rounded-lg bg-red-600 px-3 py-2 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                                      >
                                        Reject
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() => {
                                          setCommentRequestId(
                                            commentRequestId ===
                                              request.id
                                              ? ""
                                              : request.id,
                                          );
                                          setManagerComment(
                                            "",
                                          );
                                        }}
                                        className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
                                      >
                                        Comment
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <span className="text-xs text-gray-400">
                                    Processed
                                  </span>
                                )}
                              </td>
                            </tr>
                          ),
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            )}

            {activeTab === "balances" && (
              <section className="overflow-hidden rounded-xl border bg-white shadow-sm">
                <div className="border-b px-6 py-5">
                  <h2 className="text-xl font-semibold text-gray-900">
                    Employee Leave Balances
                  </h2>

                  <p className="mt-1 text-sm text-gray-500">
                    View allocated, used and remaining leave for employees.
                  </p>
                </div>

                {balances.length === 0 ? (
                  <div className="p-10 text-center text-sm text-gray-500">
                    No leave balances found.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="border-b bg-gray-50 text-sm text-gray-500">
                          <th className="px-6 py-4 font-medium">
                            Employee
                          </th>

                          <th className="px-6 py-4 font-medium">
                            Leave Type
                          </th>

                          <th className="px-6 py-4 font-medium">
                            Year
                          </th>

                          <th className="px-6 py-4 font-medium">
                            Allocated
                          </th>

                          <th className="px-6 py-4 font-medium">
                            Used
                          </th>

                          <th className="px-6 py-4 font-medium">
                            Remaining
                          </th>
                        </tr>
                      </thead>

                      <tbody>
                        {balances.map((balance) => (
                          <tr
                            key={balance.id}
                            className="border-b last:border-0"
                          >
                            <td className="px-6 py-4 font-medium text-gray-900">
                              {employeeName(
                                balance.employeeId,
                              )}
                            </td>

                            <td className="px-6 py-4 text-sm text-gray-700">
                              {balance.leaveType}
                            </td>

                            <td className="px-6 py-4 text-sm text-gray-600">
                              {balance.year}
                            </td>

                            <td className="px-6 py-4 text-sm text-gray-600">
                              {balance.allocatedDays}
                            </td>

                            <td className="px-6 py-4 text-sm text-gray-600">
                              {balance.usedDays}
                            </td>

                            <td className="px-6 py-4">
                              <span className="font-semibold text-gray-900">
                                {balance.remainingDays}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            )}

            {activeTab === "types" && (
              <>
                {showTypeForm && (
                  <section className="mb-6 rounded-xl border bg-white p-6 shadow-sm">
                    <h2 className="text-lg font-semibold text-gray-900">
                      Add Leave Type
                    </h2>

                    <form
                      onSubmit={createLeaveType}
                      className="mt-5 grid gap-4 md:grid-cols-3"
                    >
                      <div>
                        <label className="mb-2 block text-sm font-medium text-gray-700">
                          Leave Type
                        </label>

                        <input
                          value={typeName}
                          onChange={(event) =>
                            setTypeName(
                              event.target.value,
                            )
                          }
                          placeholder="Casual Leave"
                          required
                          className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-gray-500"
                        />
                      </div>

                      <div>
                        <label className="mb-2 block text-sm font-medium text-gray-700">
                          Days Per Year
                        </label>

                        <input
                          type="number"
                          min="0"
                          value={typeDays}
                          onChange={(event) =>
                            setTypeDays(
                              event.target.value,
                            )
                          }
                          required
                          className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-gray-500"
                        />
                      </div>

                      <div>
                        <label className="mb-2 block text-sm font-medium text-gray-700">
                          Description
                        </label>

                        <input
                          value={typeDescription}
                          onChange={(event) =>
                            setTypeDescription(
                              event.target.value,
                            )
                          }
                          placeholder="General paid leave"
                          className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-gray-500"
                        />
                      </div>

                      <div className="md:col-span-3">
                        <button
                          type="submit"
                          disabled={
                            actionLoading === "leave-type"
                          }
                          className="rounded-lg bg-gray-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
                        >
                          {actionLoading ===
                          "leave-type"
                            ? "Creating..."
                            : "Create Leave Type"}
                        </button>
                      </div>
                    </form>
                  </section>
                )}

                <section className="overflow-hidden rounded-xl border bg-white shadow-sm">
                  <div className="border-b px-6 py-5">
                    <h2 className="text-xl font-semibold text-gray-900">
                      Leave Types
                    </h2>

                    <p className="mt-1 text-sm text-gray-500">
                      Configure the leave categories available to employees.
                    </p>
                  </div>

                  {leaveTypes.length === 0 ? (
                    <div className="p-10 text-center text-sm text-gray-500">
                      No leave types configured.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left">
                        <thead>
                          <tr className="border-b bg-gray-50 text-sm text-gray-500">
                            <th className="px-6 py-4 font-medium">
                              Name
                            </th>

                            <th className="px-6 py-4 font-medium">
                              Description
                            </th>

                            <th className="px-6 py-4 font-medium">
                              Days / Year
                            </th>

                            <th className="px-6 py-4 font-medium">
                              Status
                            </th>
                          </tr>
                        </thead>

                        <tbody>
                          {leaveTypes.map(
                            (leaveType) => (
                              <tr
                                key={leaveType.id}
                                className="border-b last:border-0"
                              >
                                <td className="px-6 py-4 font-medium text-gray-900">
                                  {leaveType.name}
                                </td>

                                <td className="px-6 py-4 text-sm text-gray-600">
                                  {leaveType.description ||
                                    "—"}
                                </td>

                                <td className="px-6 py-4 text-sm text-gray-600">
                                  {
                                    leaveType.daysPerYear
                                  }
                                </td>

                                <td className="px-6 py-4">
                                  <StatusBadge
                                    status={
                                      leaveType.isActive ===
                                      "true"
                                        ? "active"
                                        : "inactive"
                                    }
                                  />
                                </td>
                              </tr>
                            ),
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              </>
            )}
          </>
        )}
      </div>
    </main>
  );
}

function SummaryCard({
  title,
  value,
}: {
  title: string;
  value: number;
}) {
  return (
    <div className="rounded-xl border bg-white p-5 shadow-sm">
      <p className="text-sm text-gray-500">
        {title}
      </p>

      <p className="mt-2 text-3xl font-bold text-gray-900">
        {value}
      </p>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg px-4 py-2.5 text-sm font-medium transition ${
        active
          ? "bg-gray-900 text-white"
          : "text-gray-600 hover:bg-gray-100"
      }`}
    >
      {children}
    </button>
  );
}

function StatusBadge({
  status,
}: {
  status: string;
}) {
  const styles =
    status === "approved" ||
    status === "active"
      ? "bg-green-100 text-green-700"
      : status === "rejected"
        ? "bg-red-100 text-red-700"
        : status === "pending"
          ? "bg-yellow-100 text-yellow-700"
          : "bg-gray-100 text-gray-600";

  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-medium ${styles}`}
    >
      {status}
    </span>
  );
}