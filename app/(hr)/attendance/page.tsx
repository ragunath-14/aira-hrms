"use client";

import { useEffect, useMemo, useState } from "react";
import {
  UsersIcon,
  CheckCircle2Icon,
  XCircleIcon,
  ClockIcon,
  TimerIcon,
  CalendarOffIcon,
  PartyPopperIcon,
  ClipboardListIcon,
  PencilIcon,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import {
  DataTablePagination,
  paginate,
} from "@/components/shared/data-table-pagination";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
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
import { DownloadIcon } from "lucide-react";
import { downloadCsv } from "@/lib/format/csv";
import { DeleteButton } from "@/components/shared/delete-button";
import { formatDate } from "@/lib/format/date";

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

const ALL = "all";
const PAGE_SIZE = 10;

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


export default function AttendancePage() {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [today, setToday] = useState<TodayAttendance | null>(null);

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");

  const [employeeFilter, setEmployeeFilter] = useState(ALL);
  const [departmentFilter, setDepartmentFilter] = useState(ALL);
  const [dateFilter, setDateFilter] = useState("");
  const [monthFilter, setMonthFilter] = useState("");
  const [page, setPage] = useState(1);

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
    setToday(data?.attendance ?? null);
  }

  async function loadRecords() {
    const params = new URLSearchParams();

    if (employeeFilter !== ALL) {
      params.set("employeeId", employeeFilter);
    }

    if (departmentFilter !== ALL) {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

      toast.success("Checked in successfully");
      await refreshRecords();
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Failed to check in";
      setError(message);
      toast.error(message);
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

      toast.success("Checked out successfully");
      await refreshRecords();
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Failed to check out";
      setError(message);
      toast.error(message);
    } finally {
      setActionLoading(false);
    }
  }

  function clearFilters() {
    setEmployeeFilter(ALL);
    setDepartmentFilter(ALL);
    setDateFilter("");
    setMonthFilter("");
  }

  useEffect(() => {
    setPage(1);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const pagedRecords = useMemo(
    () => paginate(records, page, PAGE_SIZE),
    [records, page],
  );

  // <input type="datetime-local"> wants local "YYYY-MM-DDTHH:mm".
  const toLocalInput = (iso: string | null) => {
    if (!iso) return "";
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const [editCheckIn, setEditCheckIn] = useState("");
  const [editCheckOut, setEditCheckOut] = useState("");

  function openEdit(record: AttendanceRecord) {
    setEditing(record);
    setEditStatus(record.status);
    setEditNotes(record.notes || "");
    setEditCheckIn(toLocalInput(record.checkIn));
    setEditCheckOut(toLocalInput(record.checkOut));
  }

  function closeEdit(open: boolean) {
    if (open || editLoading) return;

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
            checkIn: editCheckIn ? new Date(editCheckIn).toISOString() : null,
            checkOut: editCheckOut ? new Date(editCheckOut).toISOString() : null,
          }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error || "Failed to update attendance",
        );
      }

      toast.success("Attendance record updated");
      closeEdit(false);
      await loadRecords();
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Failed to update attendance";
      setError(message);
      toast.error(message);
    } finally {
      setEditLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Attendance"
        description="Track employee attendance, check-ins and check-outs."
        action={
          <Button
            variant="outline"
            disabled={records.length === 0}
            onClick={() =>
              downloadCsv(
                `attendance-${new Date().toISOString().slice(0, 10)}.csv`,
                ["Code", "Employee", "Date", "Check in", "Check out", "Status", "Notes"],
                records.map((r) => [
                  r.employeeCode,
                  formatRecordName(r),
                  r.attendanceDate,
                  r.checkIn ? new Date(r.checkIn).toLocaleTimeString("en-IN") : "",
                  r.checkOut ? new Date(r.checkOut).toLocaleTimeString("en-IN") : "",
                  statusLabels[r.status] ?? r.status,
                  r.notes,
                ]),
              )
            }
          >
            <DownloadIcon />
            Export CSV
          </Button>
        }
      />

      {error && (
        <div className="mb-6 rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Today's Attendance */}
      <Card className="mb-6">
        <CardContent className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">
              Today&apos;s Attendance
            </p>

            <h2 className="mt-1 text-xl font-semibold text-foreground">
              {today
                ? statusLabels[today.status] || today.status
                : "Not checked in"}
            </h2>

            <div className="mt-4 flex flex-wrap gap-6 text-sm">
              <div>
                <p className="text-muted-foreground">Check In</p>
                <p className="font-semibold text-foreground">
                  {formatTime(today?.checkIn || null)}
                </p>
              </div>

              <div>
                <p className="text-muted-foreground">Check Out</p>
                <p className="font-semibold text-foreground">
                  {formatTime(today?.checkOut || null)}
                </p>
              </div>

              <div>
                <p className="text-muted-foreground">Status</p>
                <div className="mt-1">
                  {today ? (
                    <StatusBadge status={today.status} />
                  ) : (
                    <span className="text-sm text-muted-foreground">
                      Not Available
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <Button
              onClick={handleCheckIn}
              disabled={actionLoading || Boolean(today?.checkIn)}
            >
              {actionLoading ? "Processing…" : "Check In"}
            </Button>

            <Button
              variant="outline"
              onClick={handleCheckOut}
              disabled={
                actionLoading ||
                !today?.checkIn ||
                Boolean(today?.checkOut)
              }
            >
              Check Out
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Summary */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        <StatCard label="Total" value={summary.total} icon={UsersIcon} />
        <StatCard
          label="Present"
          value={summary.present}
          icon={CheckCircle2Icon}
        />
        <StatCard
          label="Absent"
          value={summary.absent}
          icon={XCircleIcon}
        />
        <StatCard label="Late" value={summary.late} icon={ClockIcon} />
        <StatCard
          label="Half Day"
          value={summary.halfDay}
          icon={TimerIcon}
        />
        <StatCard
          label="Leave"
          value={summary.leave}
          icon={CalendarOffIcon}
        />
        <StatCard
          label="Holiday"
          value={summary.holiday}
          icon={PartyPopperIcon}
        />
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>
            Filter attendance records by employee, department or date.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            <div>
              <Label className="mb-1.5">Employee</Label>
              <Select
                value={employeeFilter}
                onValueChange={(value) =>
                  setEmployeeFilter(value ?? ALL)
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All Employees</SelectItem>
                  {employees.map((employee) => (
                    <SelectItem key={employee.id} value={employee.id}>
                      {formatName(employee)} ({employee.employeeCode})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="mb-1.5">Department</Label>
              <Select
                value={departmentFilter}
                onValueChange={(value) =>
                  setDepartmentFilter(value ?? ALL)
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All Departments</SelectItem>
                  {departments.map((departmentId) => (
                    <SelectItem key={departmentId} value={departmentId}>
                      {departmentId}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="mb-1.5">Date</Label>
              <Input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
              />
            </div>

            <div>
              <Label className="mb-1.5">Month</Label>
              <Input
                type="month"
                value={monthFilter}
                onChange={(e) => setMonthFilter(e.target.value)}
              />
            </div>

            <div className="flex items-end">
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={clearFilters}
              >
                Clear Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Records */}
      <Card className="overflow-hidden p-0">
        <div className="border-b px-6 py-5">
          <h2 className="text-lg font-semibold text-foreground">
            Attendance Records
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            View attendance history and make authorized corrections.
          </p>
        </div>

        {loading ? (
          <div className="space-y-2 p-6">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className="h-12 w-full" />
            ))}
          </div>
        ) : records.length === 0 ? (
          <EmptyState
            icon={ClipboardListIcon}
            title="No attendance records found"
            description="Try changing the filters or check in to create an attendance record."
          />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Check In</TableHead>
                  <TableHead>Check Out</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagedRecords.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell className="font-medium text-foreground">
                      {formatRecordName(record)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {record.employeeCode}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(record.attendanceDate)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatTime(record.checkIn)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatTime(record.checkOut)}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={record.status} />
                    </TableCell>
                    <TableCell className="max-w-55 truncate text-muted-foreground">
                      {record.notes || "-"}
                    </TableCell>
                    <TableCell className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEdit(record)}
                      >
                        <PencilIcon />
                        Correct
                      </Button>
                      <DeleteButton
                        url={`/api/attendance/${record.id}`}
                        itemName="attendance record"
                        description={`${formatRecordName(record)}'s record for ${formatDate(record.attendanceDate)} will be removed.`}
                        onDeleted={loadAll}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <DataTablePagination
              page={page}
              pageSize={PAGE_SIZE}
              total={records.length}
              onPageChange={setPage}
            />
          </>
        )}
      </Card>

      {/* Correction Dialog */}
      <Dialog open={Boolean(editing)} onOpenChange={closeEdit}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Attendance</DialogTitle>
            <DialogDescription>
              Correct the attendance record where authorized.
            </DialogDescription>
          </DialogHeader>

          {editing && (
            <div className="space-y-4">
              <div>
                <p className="text-xs font-medium text-muted-foreground">
                  Employee
                </p>
                <p className="mt-1 font-medium text-foreground">
                  {formatRecordName(editing)}
                </p>
              </div>

              <div>
                <p className="text-xs font-medium text-muted-foreground">
                  Date
                </p>
                <p className="mt-1 font-medium text-foreground">
                  {formatDate(editing.attendanceDate)}
                </p>
              </div>

              <div>
                <Label className="mb-1.5">Status</Label>
                <Select
                  value={editStatus}
                  onValueChange={(value) =>
                    setEditStatus(value ?? "present")
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {statuses.map((status) => (
                      <SelectItem key={status} value={status}>
                        {statusLabels[status]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="edit-checkin" className="mb-1.5">Check-in</Label>
                  <input
                    id="edit-checkin"
                    type="datetime-local"
                    className="h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                    value={editCheckIn}
                    onChange={(e) => setEditCheckIn(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="edit-checkout" className="mb-1.5">Check-out</Label>
                  <input
                    id="edit-checkout"
                    type="datetime-local"
                    className="h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                    value={editCheckOut}
                    onChange={(e) => setEditCheckOut(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <Label className="mb-1.5">Notes</Label>
                <Textarea
                  maxLength={500}
                  rows={4}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="Add correction notes..."
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={editLoading}
              onClick={() => closeEdit(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={editLoading}
              onClick={saveEdit}
            >
              {editLoading ? "Saving…" : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
