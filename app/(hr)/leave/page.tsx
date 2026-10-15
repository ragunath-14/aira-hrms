"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ClipboardListIcon,
  CheckCircle2Icon,
  XCircleIcon,
  CalendarDaysIcon,
  PlusIcon,
  MessageSquareIcon,
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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatINR } from "@/lib/format/currency";
import { DeleteButton } from "@/components/shared/delete-button";
import { errorText } from "@/lib/format/error-text";
import { formatDate } from "@/lib/format/date";

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
  carryForwardLimit: number | null;
  maxConsecutiveDays: number | null;
  minNoticeDays: number | null;
  encashmentAllowed: boolean;
  isPaid: boolean;
  rulesText: string | null;
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

type EncashmentRequest = {
  id: string;
  employeeId: string;
  leaveType: string;
  year: number;
  daysRequested: number;
  reason: string | null;
  status: string;
  managerComment: string | null;
  createdAt: string;
};

type AdjustmentRequest = {
  id: string;
  employeeId: string;
  leaveType: string;
  year: number;
  requestedDays: number;
  reason: string | null;
  status: string;
  managerComment: string | null;
  createdAt: string;
};

type LtcClaim = {
  id: string;
  employeeId: string;
  blockYear: string;
  destination: string | null;
  amountClaimed: string;
  reason: string | null;
  status: string;
  managerComment: string | null;
  createdAt: string;
};

const ALL = "all";
const PAGE_SIZE = 10;

export default function LeaveManagementPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [encashments, setEncashments] = useState<EncashmentRequest[]>([]);
  const [adjustments, setAdjustments] = useState<AdjustmentRequest[]>([]);
  const [ltcClaims, setLtcClaims] = useState<LtcClaim[]>([]);

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [activeTab, setActiveTab] = useState<
    | "requests"
    | "balances"
    | "types"
    | "encashments"
    | "adjustments"
    | "ltc"
  >("requests");

  const [statusFilter, setStatusFilter] = useState("pending");
  const [employeeFilter, setEmployeeFilter] = useState(ALL);
  const [requestsPage, setRequestsPage] = useState(1);
  const [balancesPage, setBalancesPage] = useState(1);

  const [showTypeForm, setShowTypeForm] = useState(false);
  const [typeName, setTypeName] = useState("");
  const [typeDescription, setTypeDescription] = useState("");
  const [typeDays, setTypeDays] = useState("12");
  const [typeCarryForward, setTypeCarryForward] = useState("");
  const [typeMaxConsecutive, setTypeMaxConsecutive] = useState("");
  const [typeMinNotice, setTypeMinNotice] = useState("");
  const [typeEncashmentAllowed, setTypeEncashmentAllowed] = useState("false");
  const [typePaid, setTypePaid] = useState("true");
  const [typeRulesText, setTypeRulesText] = useState("");

  const [editingType, setEditingType] = useState<LeaveType | null>(null);
  const [editCarryForward, setEditCarryForward] = useState("");
  const [editMaxConsecutive, setEditMaxConsecutive] = useState("");
  const [editMinNotice, setEditMinNotice] = useState("");
  const [editEncashmentAllowed, setEditEncashmentAllowed] = useState("false");
  const [editPaid, setEditPaid] = useState("true");
  const [editRulesText, setEditRulesText] = useState("");
  const [savingRules, setSavingRules] = useState(false);

  const [commentRequestId, setCommentRequestId] = useState("");
  const [managerComment, setManagerComment] = useState("");

  const [encashmentCommentId, setEncashmentCommentId] = useState("");
  const [encashmentComment, setEncashmentComment] = useState("");
  const [adjustmentCommentId, setAdjustmentCommentId] = useState("");
  const [adjustmentComment, setAdjustmentComment] = useState("");
  const [ltcCommentId, setLtcCommentId] = useState("");
  const [ltcComment, setLtcComment] = useState("");

  async function loadEmployees() {
    const response = await fetch("/api/employees");

    const data = await response.json();

    if (!response.ok) {
      throw new Error(errorText(data.error, "Failed to fetch employees"));
    }

    setEmployees(Array.isArray(data) ? data : []);
    return Array.isArray(data) ? data : [];
  }

  async function loadLeaveTypes() {
    const response = await fetch("/api/leave-types");

    const data = await response.json();

    if (!response.ok) {
      throw new Error(errorText(data.error, "Failed to fetch leave types"));
    }

    setLeaveTypes(Array.isArray(data) ? data : []);
  }

  // HR/manager/owner callers get every employee's balances back from a
  // single request (the API omits the employeeId filter for them) —
  // this used to loop once per employee (N+1) before that support existed.
  async function loadBalances() {
    const response = await fetch("/api/leave-balances");

    if (!response.ok) {
      setBalances([]);
      return;
    }

    const data = await response.json();

    setBalances(Array.isArray(data) ? data : []);
  }

  async function loadRequests() {
    const response = await fetch("/api/leave-requests");

    if (!response.ok) {
      setRequests([]);
      return;
    }

    const data = await response.json();

    setRequests(Array.isArray(data) ? data : []);
  }

  async function loadEncashments() {
    const response = await fetch("/api/leave-encashment");

    if (!response.ok) {
      setEncashments([]);
      return;
    }

    const data = await response.json();

    setEncashments(Array.isArray(data) ? data : []);
  }

  async function loadAdjustments() {
    const response = await fetch("/api/leave-adjustment");

    if (!response.ok) {
      setAdjustments([]);
      return;
    }

    const data = await response.json();

    setAdjustments(Array.isArray(data) ? data : []);
  }

  async function loadLtcClaims() {
    const response = await fetch("/api/ltc-claims");

    if (!response.ok) {
      setLtcClaims([]);
      return;
    }

    const data = await response.json();

    setLtcClaims(Array.isArray(data) ? data : []);
  }

  async function loadData() {
    try {
      setLoading(true);
      setError("");

      await Promise.all([
        loadEmployees(),
        loadLeaveTypes(),
        loadBalances(),
        loadRequests(),
        loadEncashments(),
        loadAdjustments(),
        loadLtcClaims(),
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

      const message =
        action === "approve"
          ? "Leave request approved successfully."
          : "Leave request rejected successfully.";

      setSuccess(message);
      toast.success(message);

      setCommentRequestId("");
      setManagerComment("");

      await loadData();
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Failed to process leave request";
      setError(message);
      toast.error(message);
    } finally {
      setActionLoading("");
    }
  }

  async function processEncashment(
    requestId: string,
    action: "approve" | "reject",
  ) {
    try {
      setActionLoading(requestId);
      setError("");
      setSuccess("");

      const response = await fetch(
        `/api/leave-encashment/${requestId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action,
            comment:
              encashmentCommentId === requestId
                ? encashmentComment
                : "",
          }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Failed to process encashment request",
        );
      }

      const message =
        action === "approve"
          ? "Encashment request approved successfully."
          : "Encashment request rejected successfully.";

      setSuccess(message);
      toast.success(message);
      setEncashmentCommentId("");
      setEncashmentComment("");

      await loadData();
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Failed to process encashment request";
      setError(message);
      toast.error(message);
    } finally {
      setActionLoading("");
    }
  }

  async function processAdjustment(
    requestId: string,
    action: "approve" | "reject",
  ) {
    try {
      setActionLoading(requestId);
      setError("");
      setSuccess("");

      const response = await fetch(
        `/api/leave-adjustment/${requestId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action,
            comment:
              adjustmentCommentId === requestId
                ? adjustmentComment
                : "",
          }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Failed to process adjustment request",
        );
      }

      const message =
        action === "approve"
          ? "Adjustment request approved successfully."
          : "Adjustment request rejected successfully.";

      setSuccess(message);
      toast.success(message);
      setAdjustmentCommentId("");
      setAdjustmentComment("");

      await loadData();
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Failed to process adjustment request";
      setError(message);
      toast.error(message);
    } finally {
      setActionLoading("");
    }
  }

  async function processLtcClaim(
    requestId: string,
    action: "approve" | "reject",
  ) {
    try {
      setActionLoading(requestId);
      setError("");
      setSuccess("");

      const response = await fetch(
        `/api/ltc-claims/${requestId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action,
            comment: ltcCommentId === requestId ? ltcComment : "",
          }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Failed to process LTC claim",
        );
      }

      const message =
        action === "approve"
          ? "LTC claim approved successfully."
          : "LTC claim rejected successfully.";

      setSuccess(message);
      toast.success(message);
      setLtcCommentId("");
      setLtcComment("");

      await loadData();
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Failed to process LTC claim";
      setError(message);
      toast.error(message);
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
          carryForwardLimit: typeCarryForward ? Number(typeCarryForward) : null,
          maxConsecutiveDays: typeMaxConsecutive ? Number(typeMaxConsecutive) : null,
          minNoticeDays: typeMinNotice ? Number(typeMinNotice) : null,
          encashmentAllowed: typeEncashmentAllowed === "true",
          isPaid: typePaid === "true",
          rulesText: typeRulesText.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Failed to create leave type",
        );
      }

      setSuccess("Leave type created successfully.");
      toast.success("Leave type created successfully.");
      setShowTypeForm(false);
      setTypeName("");
      setTypeDescription("");
      setTypeDays("12");
      setTypeCarryForward("");
      setTypeMaxConsecutive("");
      setTypeMinNotice("");
      setTypeEncashmentAllowed("false");
      setTypeRulesText("");

      await loadLeaveTypes();
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Failed to create leave type";
      setError(message);
      toast.error(message);
    } finally {
      setActionLoading("");
    }
  }

  function openEditRules(leaveType: LeaveType) {
    setEditingType(leaveType);
    setEditCarryForward(leaveType.carryForwardLimit?.toString() ?? "");
    setEditMaxConsecutive(leaveType.maxConsecutiveDays?.toString() ?? "");
    setEditMinNotice(leaveType.minNoticeDays?.toString() ?? "");
    setEditEncashmentAllowed(leaveType.encashmentAllowed ? "true" : "false");
    setEditPaid(leaveType.isPaid === false ? "false" : "true");
    setEditRulesText(leaveType.rulesText ?? "");
  }

  async function saveRules() {
    if (!editingType) return;

    try {
      setSavingRules(true);
      setError("");
      setSuccess("");

      const response = await fetch(`/api/leave-types/${editingType.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          carryForwardLimit: editCarryForward ? Number(editCarryForward) : null,
          maxConsecutiveDays: editMaxConsecutive ? Number(editMaxConsecutive) : null,
          minNoticeDays: editMinNotice ? Number(editMinNotice) : null,
          encashmentAllowed: editEncashmentAllowed === "true",
          isPaid: editPaid === "true",
          rulesText: editRulesText.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(errorText(data.error, "Failed to update leave type rules"));
      }

      setSuccess("Leave type rules updated successfully.");
      toast.success("Leave type rules updated successfully.");
      setEditingType(null);

      await loadLeaveTypes();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to update leave type rules";
      setError(message);
      toast.error(message);
    } finally {
      setSavingRules(false);
    }
  }

  const filteredRequests = useMemo(() => {
    return requests
      .filter((request) =>
        statusFilter && statusFilter !== ALL
          ? request.status === statusFilter
          : true,
      )
      .filter((request) =>
        employeeFilter !== ALL
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

  useEffect(() => {
    setRequestsPage(1);
  }, [statusFilter, employeeFilter]);

  const pagedRequests = useMemo(
    () => paginate(filteredRequests, requestsPage, PAGE_SIZE),
    [filteredRequests, requestsPage],
  );

  const pagedBalances = useMemo(
    () => paginate(balances, balancesPage, PAGE_SIZE),
    [balances, balancesPage],
  );

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
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Leave Management"
        description="Manage leave types, employee balances and leave requests."
        action={
          activeTab === "types" ? (
            <Button
              type="button"
              onClick={() => setShowTypeForm((value) => !value)}
            >
              <PlusIcon />
              {showTypeForm ? "Cancel" : "Add Leave Type"}
            </Button>
          ) : undefined
        }
      />

      {error && (
        <div className="mb-6 rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-6 rounded-lg border border-primary/20 bg-primary/10 p-4 text-sm text-primary">
          {success}
        </div>
      )}

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Pending Requests"
          value={pendingCount}
          icon={ClipboardListIcon}
        />
        <StatCard
          label="Approved"
          value={approvedCount}
          icon={CheckCircle2Icon}
        />
        <StatCard
          label="Rejected"
          value={rejectedCount}
          icon={XCircleIcon}
        />
        <StatCard
          label="Remaining Leave Days"
          value={totalRemainingDays}
          icon={CalendarDaysIcon}
        />
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(value) =>
          setActiveTab((value as typeof activeTab) ?? "requests")
        }
      >
        <TabsList className="mb-6 h-auto w-full flex-wrap justify-start gap-1">
          <TabsTrigger value="requests">Leave Requests</TabsTrigger>
          <TabsTrigger value="balances">Leave Balances</TabsTrigger>
          <TabsTrigger value="types">Leave Types</TabsTrigger>
          <TabsTrigger value="encashments">Encashment</TabsTrigger>
          <TabsTrigger value="adjustments">Adjustment</TabsTrigger>
          <TabsTrigger value="ltc">LTC Claims</TabsTrigger>
        </TabsList>

        {loading ? (
          <Card>
            <CardContent className="space-y-2 p-6">
              {Array.from({ length: 5 }).map((_, index) => (
                <Skeleton key={index} className="h-12 w-full" />
              ))}
            </CardContent>
          </Card>
        ) : (
          <>
            <TabsContent value="requests">
              <Card className="overflow-hidden p-0">
                <div className="border-b px-6 py-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                      <h2 className="text-lg font-semibold text-foreground">
                        Leave Requests
                      </h2>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Review and process employee leave applications.
                      </p>
                    </div>

                    <div className="flex flex-col gap-3 sm:flex-row">
                      <Select
                        value={statusFilter || ALL}
                        onValueChange={(value) =>
                          setStatusFilter(
                            value === ALL ? "" : (value ?? ""),
                          )
                        }
                      >
                        <SelectTrigger className="w-full sm:w-44">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={ALL}>All Statuses</SelectItem>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="approved">Approved</SelectItem>
                          <SelectItem value="rejected">Rejected</SelectItem>
                        </SelectContent>
                      </Select>

                      <Select
                        value={employeeFilter}
                        onValueChange={(value) =>
                          setEmployeeFilter(value ?? ALL)
                        }
                      >
                        <SelectTrigger className="w-full sm:w-56">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={ALL}>All Employees</SelectItem>
                          {employees.map((employee) => (
                            <SelectItem key={employee.id} value={employee.id}>
                              {employeeName(employee.id)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                {filteredRequests.length === 0 ? (
                  <EmptyState
                    icon={ClipboardListIcon}
                    title="No leave requests found"
                    description="There are no requests matching the selected filters."
                  />
                ) : (
                  <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Employee</TableHead>
                        <TableHead>Leave Type</TableHead>
                        <TableHead>Dates</TableHead>
                        <TableHead>Days</TableHead>
                        <TableHead>Reason</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pagedRequests.map((request) => (
                        <TableRow key={request.id}>
                          <TableCell>
                            <div className="font-medium text-foreground">
                              {employeeName(request.employeeId)}
                            </div>
                            <div className="mt-1 text-xs text-muted-foreground">
                              {
                                employees.find(
                                  (employee) =>
                                    employee.id === request.employeeId,
                                )?.employeeCode
                              }
                            </div>
                          </TableCell>

                          <TableCell className="text-muted-foreground">
                            {request.leaveType}
                          </TableCell>

                          <TableCell className="text-muted-foreground">
                            {formatDate(request.startDate)} → {formatDate(request.endDate)}
                          </TableCell>

                          <TableCell className="font-medium text-foreground">
                            {request.totalDays}
                          </TableCell>

                          <TableCell className="max-w-xs truncate text-muted-foreground">
                            {request.reason || "—"}
                          </TableCell>

                          <TableCell>
                            <StatusBadge status={request.status} />
                          </TableCell>

                          <TableCell>
                            {request.status === "pending" ? (
                              <div className="flex min-w-50 flex-col gap-2">
                                {commentRequestId === request.id && (
                                  <Textarea
                                    value={managerComment}
                                    onChange={(event) =>
                                      setManagerComment(
                                        event.target.value,
                                      )
                                    }
                                    placeholder="Optional manager comment..."
                                    rows={2}
                                  />
                                )}

                                <div className="flex flex-wrap gap-2">
                                  <Button
                                    type="button"
                                    size="sm"
                                    disabled={actionLoading === request.id}
                                    onClick={() =>
                                      processRequest(request.id, "approve")
                                    }
                                  >
                                    Approve
                                  </Button>

                                  <Button
                                    type="button"
                                    variant="destructive"
                                    size="sm"
                                    disabled={actionLoading === request.id}
                                    onClick={() =>
                                      processRequest(request.id, "reject")
                                    }
                                  >
                                    Reject
                                  </Button>

                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      setCommentRequestId(
                                        commentRequestId === request.id
                                          ? ""
                                          : request.id,
                                      );
                                      setManagerComment("");
                                    }}
                                  >
                                    <MessageSquareIcon />
                                    Comment
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">
                                Processed
                              </span>
                            )}
                            <DeleteButton
                              url={`/api/leave-requests/${request.id}`}
                              itemName="leave request"
                              description={
                                request.status === "approved"
                                  ? "The approved days are given back to the employee's leave balance."
                                  : "The request will be removed."
                              }
                              onDeleted={() => {
                                loadRequests();
                                loadBalances();
                              }}
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  <DataTablePagination
                    page={requestsPage}
                    pageSize={PAGE_SIZE}
                    total={filteredRequests.length}
                    onPageChange={setRequestsPage}
                  />
                  </>
                )}
              </Card>
            </TabsContent>

            <TabsContent value="balances">
              <Card className="overflow-hidden p-0">
                <div className="border-b px-6 py-5">
                  <h2 className="text-lg font-semibold text-foreground">
                    Employee Leave Balances
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    View allocated, used and remaining leave for employees.
                  </p>
                </div>

                {balances.length === 0 ? (
                  <EmptyState
                    icon={CalendarDaysIcon}
                    title="No leave balances found"
                  />
                ) : (
                  <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Employee</TableHead>
                        <TableHead>Leave Type</TableHead>
                        <TableHead>Year</TableHead>
                        <TableHead>Allocated</TableHead>
                        <TableHead>Used</TableHead>
                        <TableHead>Remaining</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pagedBalances.map((balance) => (
                        <TableRow key={balance.id}>
                          <TableCell className="font-medium text-foreground">
                            {employeeName(balance.employeeId)}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {balance.leaveType}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {balance.year}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {balance.allocatedDays}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {balance.usedDays}
                          </TableCell>
                          <TableCell className="font-semibold text-foreground">
                            {balance.remainingDays}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  <DataTablePagination
                    page={balancesPage}
                    pageSize={PAGE_SIZE}
                    total={balances.length}
                    onPageChange={setBalancesPage}
                  />
                  </>
                )}
              </Card>
            </TabsContent>

            <TabsContent value="types">
              {showTypeForm && (
                <Card className="mb-6">
                  <CardHeader>
                    <CardTitle>Add Leave Type</CardTitle>
                  </CardHeader>

                  <CardContent>
                    <form
                      onSubmit={createLeaveType}
                      className="grid gap-4 md:grid-cols-3"
                    >
                      <div>
                        <Label className="mb-2">Leave Type</Label>
                        <Input
                          value={typeName}
                          onChange={(event) =>
                            setTypeName(event.target.value)
                          }
                          placeholder="Casual Leave"
                          required
                        />
                      </div>

                      <div>
                        <Label className="mb-2">Days Per Year</Label>
                        <Input
                          type="number"
                          min="0"
                          value={typeDays}
                          onChange={(event) =>
                            setTypeDays(event.target.value)
                          }
                          required
                        />
                      </div>

                      <div>
                        <Label className="mb-2">Description</Label>
                        <Input
                          value={typeDescription}
                          onChange={(event) =>
                            setTypeDescription(event.target.value)
                          }
                          placeholder="General paid leave"
                        />
                      </div>

                      <div>
                        <Label className="mb-2">Carry Forward Limit</Label>
                        <Input
                          type="number"
                          min="0"
                          value={typeCarryForward}
                          onChange={(event) => setTypeCarryForward(event.target.value)}
                          placeholder="Optional"
                        />
                      </div>

                      <div>
                        <Label className="mb-2">Max Consecutive Days</Label>
                        <Input
                          type="number"
                          min="0"
                          value={typeMaxConsecutive}
                          onChange={(event) => setTypeMaxConsecutive(event.target.value)}
                          placeholder="Optional"
                        />
                      </div>

                      <div>
                        <Label className="mb-2">Min Notice (Days)</Label>
                        <Input
                          type="number"
                          min="0"
                          value={typeMinNotice}
                          onChange={(event) => setTypeMinNotice(event.target.value)}
                          placeholder="Optional"
                        />
                      </div>

                      <div>
                        <Label className="mb-2">Encashment</Label>
                        <Select
                          value={typeEncashmentAllowed}
                          onValueChange={(value) => setTypeEncashmentAllowed(value ?? "false")}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="false">Not Allowed</SelectItem>
                            <SelectItem value="true">Allowed</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label className="mb-2">Pay</Label>
                        <Select value={typePaid} onValueChange={(value) => setTypePaid(value ?? "true")}>
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="true">Paid leave</SelectItem>
                            <SelectItem value="false">Unpaid (loss of pay)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="md:col-span-2">
                        <Label className="mb-2">Rules Text</Label>
                        <Input
                          value={typeRulesText}
                          onChange={(event) => setTypeRulesText(event.target.value)}
                          placeholder="Shown to employees on the Leave Rules page"
                        />
                      </div>

                      <div className="md:col-span-3">
                        <Button
                          type="submit"
                          disabled={actionLoading === "leave-type"}
                        >
                          {actionLoading === "leave-type"
                            ? "Creating…"
                            : "Create Leave Type"}
                        </Button>
                      </div>
                    </form>
                  </CardContent>
                </Card>
              )}

              <Card className="overflow-hidden p-0">
                <div className="border-b px-6 py-5">
                  <h2 className="text-lg font-semibold text-foreground">
                    Leave Types
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Configure the leave categories available to employees.
                  </p>
                </div>

                {leaveTypes.length === 0 ? (
                  <EmptyState
                    icon={ClipboardListIcon}
                    title="No leave types configured"
                  />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Days / Year</TableHead>
                        <TableHead>Encashment</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {leaveTypes.map((leaveType) => (
                        <TableRow key={leaveType.id}>
                          <TableCell className="font-medium text-foreground">
                            {leaveType.name}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {leaveType.description || "—"}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {leaveType.daysPerYear}
                          </TableCell>
                          <TableCell>
                            <StatusBadge
                              status={leaveType.encashmentAllowed ? "active" : "inactive"}
                            />
                          </TableCell>
                          <TableCell>
                            <StatusBadge
                              status={
                                leaveType.isActive === "true"
                                  ? "active"
                                  : "inactive"
                              }
                            />
                          </TableCell>
                          <TableCell className="flex items-center gap-1">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => openEditRules(leaveType)}
                            >
                              Edit Rules
                            </Button>
                            <DeleteButton
                              url={`/api/leave-types/${leaveType.id}`}
                              itemName={leaveType.name}
                              description="Only leave types nobody has requested yet can be deleted. Otherwise mark it inactive."
                              onDeleted={loadLeaveTypes}
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </Card>
            </TabsContent>

            <TabsContent value="encashments">
              <Card className="overflow-hidden p-0">
                <div className="border-b px-6 py-5">
                  <h2 className="text-lg font-semibold text-foreground">
                    Leave Encashment Requests
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Review and process employee requests to encash unused leave.
                  </p>
                </div>

                {encashments.length === 0 ? (
                  <EmptyState
                    icon={ClipboardListIcon}
                    title="No encashment requests"
                  />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Employee</TableHead>
                        <TableHead>Leave Type</TableHead>
                        <TableHead>Year</TableHead>
                        <TableHead>Days</TableHead>
                        <TableHead>Reason</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {encashments.map((request) => (
                        <TableRow key={request.id}>
                          <TableCell className="font-medium text-foreground">
                            {employeeName(request.employeeId)}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {request.leaveType}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {request.year}
                          </TableCell>
                          <TableCell className="font-medium text-foreground">
                            {request.daysRequested}
                          </TableCell>
                          <TableCell className="max-w-xs truncate text-muted-foreground">
                            {request.reason || "—"}
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={request.status} />
                          </TableCell>
                          <TableCell>
                            {request.status === "pending" ? (
                              <div className="flex min-w-50 flex-col gap-2">
                                {encashmentCommentId === request.id && (
                                  <Textarea
                                    value={encashmentComment}
                                    onChange={(event) =>
                                      setEncashmentComment(event.target.value)
                                    }
                                    placeholder="Optional comment..."
                                    rows={2}
                                  />
                                )}
                                <div className="flex flex-wrap gap-2">
                                  <Button
                                    type="button"
                                    size="sm"
                                    disabled={actionLoading === request.id}
                                    onClick={() => processEncashment(request.id, "approve")}
                                  >
                                    Approve
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="destructive"
                                    size="sm"
                                    disabled={actionLoading === request.id}
                                    onClick={() => processEncashment(request.id, "reject")}
                                  >
                                    Reject
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      setEncashmentCommentId(
                                        encashmentCommentId === request.id ? "" : request.id,
                                      );
                                      setEncashmentComment("");
                                    }}
                                  >
                                    <MessageSquareIcon />
                                    Comment
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">Processed</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </Card>
            </TabsContent>

            <TabsContent value="adjustments">
              <Card className="overflow-hidden p-0">
                <div className="border-b px-6 py-5">
                  <h2 className="text-lg font-semibold text-foreground">
                    Leave Adjustment Requests
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Review and process employee-reported balance corrections.
                  </p>
                </div>

                {adjustments.length === 0 ? (
                  <EmptyState
                    icon={ClipboardListIcon}
                    title="No adjustment requests"
                  />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Employee</TableHead>
                        <TableHead>Leave Type</TableHead>
                        <TableHead>Year</TableHead>
                        <TableHead>Days</TableHead>
                        <TableHead>Reason</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {adjustments.map((request) => (
                        <TableRow key={request.id}>
                          <TableCell className="font-medium text-foreground">
                            {employeeName(request.employeeId)}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {request.leaveType}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {request.year}
                          </TableCell>
                          <TableCell className="font-medium text-foreground">
                            {request.requestedDays > 0 ? "+" : ""}
                            {request.requestedDays}
                          </TableCell>
                          <TableCell className="max-w-xs truncate text-muted-foreground">
                            {request.reason || "—"}
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={request.status} />
                          </TableCell>
                          <TableCell>
                            {request.status === "pending" ? (
                              <div className="flex min-w-50 flex-col gap-2">
                                {adjustmentCommentId === request.id && (
                                  <Textarea
                                    value={adjustmentComment}
                                    onChange={(event) =>
                                      setAdjustmentComment(event.target.value)
                                    }
                                    placeholder="Optional comment..."
                                    rows={2}
                                  />
                                )}
                                <div className="flex flex-wrap gap-2">
                                  <Button
                                    type="button"
                                    size="sm"
                                    disabled={actionLoading === request.id}
                                    onClick={() => processAdjustment(request.id, "approve")}
                                  >
                                    Approve
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="destructive"
                                    size="sm"
                                    disabled={actionLoading === request.id}
                                    onClick={() => processAdjustment(request.id, "reject")}
                                  >
                                    Reject
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      setAdjustmentCommentId(
                                        adjustmentCommentId === request.id ? "" : request.id,
                                      );
                                      setAdjustmentComment("");
                                    }}
                                  >
                                    <MessageSquareIcon />
                                    Comment
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">Processed</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </Card>
            </TabsContent>

            <TabsContent value="ltc">
              <Card className="overflow-hidden p-0">
                <div className="border-b px-6 py-5">
                  <h2 className="text-lg font-semibold text-foreground">
                    LTC Claims
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Review and process Leave Travel Concession claims.
                  </p>
                </div>

                {ltcClaims.length === 0 ? (
                  <EmptyState
                    icon={ClipboardListIcon}
                    title="No LTC claims"
                  />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Employee</TableHead>
                        <TableHead>Block Year</TableHead>
                        <TableHead>Destination</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {ltcClaims.map((claim) => (
                        <TableRow key={claim.id}>
                          <TableCell className="font-medium text-foreground">
                            {employeeName(claim.employeeId)}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {claim.blockYear}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {claim.destination || "—"}
                          </TableCell>
                          <TableCell className="font-medium text-foreground">
                            {formatINR(claim.amountClaimed)}
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={claim.status} />
                          </TableCell>
                          <TableCell>
                            {claim.status === "pending" ? (
                              <div className="flex min-w-50 flex-col gap-2">
                                {ltcCommentId === claim.id && (
                                  <Textarea
                                    value={ltcComment}
                                    onChange={(event) =>
                                      setLtcComment(event.target.value)
                                    }
                                    placeholder="Optional comment..."
                                    rows={2}
                                  />
                                )}
                                <div className="flex flex-wrap gap-2">
                                  <Button
                                    type="button"
                                    size="sm"
                                    disabled={actionLoading === claim.id}
                                    onClick={() => processLtcClaim(claim.id, "approve")}
                                  >
                                    Approve
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="destructive"
                                    size="sm"
                                    disabled={actionLoading === claim.id}
                                    onClick={() => processLtcClaim(claim.id, "reject")}
                                  >
                                    Reject
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      setLtcCommentId(
                                        ltcCommentId === claim.id ? "" : claim.id,
                                      );
                                      setLtcComment("");
                                    }}
                                  >
                                    <MessageSquareIcon />
                                    Comment
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">Processed</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </Card>
            </TabsContent>
          </>
        )}
      </Tabs>

      <Dialog open={!!editingType} onOpenChange={(open) => !open && setEditingType(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Rules — {editingType?.name}</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4">
            <div>
              <Label className="mb-2">Carry Forward Limit</Label>
              <Input
                type="number"
                min="0"
                value={editCarryForward}
                onChange={(event) => setEditCarryForward(event.target.value)}
                placeholder="Optional"
              />
            </div>

            <div>
              <Label className="mb-2">Max Consecutive Days</Label>
              <Input
                type="number"
                min="0"
                value={editMaxConsecutive}
                onChange={(event) => setEditMaxConsecutive(event.target.value)}
                placeholder="Optional"
              />
            </div>

            <div>
              <Label className="mb-2">Min Notice (Days)</Label>
              <Input
                type="number"
                min="0"
                value={editMinNotice}
                onChange={(event) => setEditMinNotice(event.target.value)}
                placeholder="Optional"
              />
            </div>

            <div>
              <Label className="mb-2">Encashment</Label>
              <Select
                value={editEncashmentAllowed}
                onValueChange={(value) => setEditEncashmentAllowed(value ?? "false")}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="false">Not Allowed</SelectItem>
                  <SelectItem value="true">Allowed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="mb-2">Pay</Label>
              <Select value={editPaid} onValueChange={(value) => setEditPaid(value ?? "true")}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">Paid leave</SelectItem>
                  <SelectItem value="false">Unpaid (loss of pay)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="mb-2">Rules Text</Label>
              <Input
                value={editRulesText}
                onChange={(event) => setEditRulesText(event.target.value)}
                placeholder="Shown to employees on the Leave Rules page"
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditingType(null)}>
              Cancel
            </Button>
            <Button type="button" disabled={savingRules} onClick={saveRules}>
              {savingRules ? "Saving…" : "Save Rules"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
