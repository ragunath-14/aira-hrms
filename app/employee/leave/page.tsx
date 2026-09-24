"use client";

import { useEffect, useMemo, useState } from "react";
import { ClipboardListIcon } from "lucide-react";

import { ConfirmDialog } from "@/components/hr/confirm-dialog";
import { RouteTabs } from "@/components/hr/route-tabs";
import { StatusBadge } from "@/components/hr/status-badge";
import { EmptyState } from "@/components/hr/empty-state";
import {
  DataTablePagination,
  paginate,
} from "@/components/hr/data-table-pagination";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

const LEAVE_NAV = [
  { href: "/employee/leave", label: "Overview", exact: true },
  { href: "/employee/leave/planner", label: "Planner" },
  { href: "/employee/leave/encashment", label: "Encashment" },
  { href: "/employee/leave/adjustment", label: "Adjustment" },
  { href: "/employee/leave/ltc", label: "LTC" },
  { href: "/employee/leave/rules", label: "Rules" },
];

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

const PAGE_SIZE = 10;

export default function EmployeeLeavePage() {
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [leaveBalances, setLeaveBalances] = useState<LeaveBalance[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [reqPage, setReqPage] = useState(1);

  const [leaveTypeId, setLeaveTypeId] = useState("");
  const [leaveStart, setLeaveStart] = useState("");
  const [leaveEnd, setLeaveEnd] = useState("");
  const [leaveReason, setLeaveReason] = useState("");
  const [submittingLeave, setSubmittingLeave] = useState(false);
  const [leaveMsg, setLeaveMsg] = useState("");

  const [cancelTarget, setCancelTarget] = useState<LeaveRequest | null>(null);
  const [cancelling, setCancelling] = useState(false);

  async function loadAll() {
    try {
      setLoading(true);

      const [typesRes, balancesRes, requestsRes] = await Promise.all([
        fetch("/api/leave-types"),
        fetch("/api/employee/leave-balances"),
        fetch("/api/employee/leave-requests"),
      ]);

      if (typesRes.ok) {
        const d = await typesRes.json();
        setLeaveTypes(Array.isArray(d) ? d : []);
      }
      if (balancesRes.ok) {
        const d = await balancesRes.json();
        setLeaveBalances(Array.isArray(d) ? d : []);
      }
      if (requestsRes.ok) {
        const d = await requestsRes.json();
        setLeaveRequests(Array.isArray(d) ? d : []);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  async function handleLeaveSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!leaveTypeId || !leaveStart || !leaveEnd) {
      setLeaveMsg("All fields are required");
      return;
    }
    setSubmittingLeave(true);
    setLeaveMsg("");
    try {
      const res = await fetch("/api/leave-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leaveTypeId,
          startDate: leaveStart,
          endDate: leaveEnd,
          reason: leaveReason,
        }),
      });
      const d = await res.json();
      if (!res.ok) {
        setLeaveMsg(d.error ?? "Failed to submit leave");
      } else {
        setLeaveMsg("Leave request submitted successfully!");
        setLeaveTypeId("");
        setLeaveStart("");
        setLeaveEnd("");
        setLeaveReason("");
        await loadAll();
      }
    } catch {
      setLeaveMsg("Failed to submit leave request");
    } finally {
      setSubmittingLeave(false);
    }
  }

  async function confirmCancel() {
    if (!cancelTarget) return;
    setCancelling(true);
    try {
      const res = await fetch(`/api/employee/leave-requests/${cancelTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel" }),
      });
      if (res.ok) {
        await loadAll();
      }
    } finally {
      setCancelling(false);
      setCancelTarget(null);
    }
  }

  const pagedRequests = useMemo(
    () => paginate(leaveRequests, reqPage, PAGE_SIZE),
    [leaveRequests, reqPage],
  );

  const leaveMsgIsError =
    leaveMsg.includes("failed") || leaveMsg.includes("Failed") || leaveMsg.includes("Insufficient");

  if (loading) {
    return (
      <div className="space-y-6">
        <RouteTabs tabs={LEAVE_NAV} />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <RouteTabs tabs={LEAVE_NAV} />

      <Card className="overflow-hidden p-0">
        <div className="border-b px-6 py-4">
          <h2 className="text-lg font-semibold text-foreground">My Leave Balances</h2>
        </div>
        {leaveBalances.length === 0 ? (
          <EmptyState icon={ClipboardListIcon} title="No leave balances found" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Year</TableHead>
                <TableHead>Allocated</TableHead>
                <TableHead>Used</TableHead>
                <TableHead>Remaining</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leaveBalances.map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="font-medium text-foreground">{b.leaveType ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{b.year}</TableCell>
                  <TableCell>{b.allocatedDays}</TableCell>
                  <TableCell>{b.usedDays}</TableCell>
                  <TableCell className="font-bold text-foreground">{b.remainingDays}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Apply for Leave</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLeaveSubmit} className="grid gap-4 md:grid-cols-2">
            <div>
              <Label className="mb-1.5">Leave Type</Label>
              <Select value={leaveTypeId || null} onValueChange={(value) => setLeaveTypeId(value ?? "")}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="— Select leave type —" />
                </SelectTrigger>
                <SelectContent>
                  {leaveTypes.map((lt) => (
                    <SelectItem key={lt.id} value={lt.id}>
                      {lt.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="hidden md:block" />

            <div>
              <Label className="mb-1.5">Start Date</Label>
              <Input type="date" value={leaveStart} onChange={(e) => setLeaveStart(e.target.value)} required />
            </div>

            <div>
              <Label className="mb-1.5">End Date</Label>
              <Input type="date" value={leaveEnd} onChange={(e) => setLeaveEnd(e.target.value)} required />
            </div>

            <div className="md:col-span-2">
              <Label className="mb-1.5">Reason (optional)</Label>
              <Textarea
                value={leaveReason}
                onChange={(e) => setLeaveReason(e.target.value)}
                rows={2}
                placeholder="Reason for leave…"
              />
            </div>

            {leaveMsg && (
              <p className={`text-sm md:col-span-2 ${leaveMsgIsError ? "text-destructive" : "text-primary"}`}>
                {leaveMsg}
              </p>
            )}

            <div className="flex justify-end md:col-span-2">
              <Button type="submit" disabled={submittingLeave}>
                {submittingLeave ? "Submitting…" : "Submit Leave Request"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="overflow-hidden p-0">
        <div className="border-b px-6 py-4">
          <h2 className="text-lg font-semibold text-foreground">My Leave Requests</h2>
        </div>
        {leaveRequests.length === 0 ? (
          <EmptyState
            icon={ClipboardListIcon}
            title="No leave requests"
            description="Leave requests you submit will appear here."
          />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Dates</TableHead>
                  <TableHead>Days</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Comment</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagedRequests.map((lr) => (
                  <TableRow key={lr.id}>
                    <TableCell className="font-medium text-foreground">{lr.leaveType ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {lr.startDate} → {lr.endDate}
                    </TableCell>
                    <TableCell>{lr.totalDays}</TableCell>
                    <TableCell>
                      <StatusBadge status={lr.status} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">{lr.managerComment ?? "—"}</TableCell>
                    <TableCell>
                      {(lr.status === "pending" || lr.status === "approved") && (
                        <Button variant="outline" size="sm" onClick={() => setCancelTarget(lr)}>
                          Cancel
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <DataTablePagination
              page={reqPage}
              pageSize={PAGE_SIZE}
              total={leaveRequests.length}
              onPageChange={setReqPage}
            />
          </>
        )}
      </Card>

      <ConfirmDialog
        open={!!cancelTarget}
        onOpenChange={(open) => !open && setCancelTarget(null)}
        title="Cancel leave request?"
        description={
          cancelTarget
            ? `This will cancel your ${cancelTarget.leaveType ?? "leave"} request from ${cancelTarget.startDate} to ${cancelTarget.endDate}${
                cancelTarget.status === "approved" ? " and restore the leave balance" : ""
              }.`
            : undefined
        }
        confirmLabel="Cancel Request"
        loading={cancelling}
        onConfirm={confirmCancel}
      />
    </div>
  );
}
