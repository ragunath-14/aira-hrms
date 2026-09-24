"use client";

import { useEffect, useState } from "react";
import { BanknoteIcon } from "lucide-react";

import { RouteTabs } from "@/components/hr/route-tabs";
import { StatusBadge } from "@/components/hr/status-badge";
import { EmptyState } from "@/components/hr/empty-state";
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

type LeaveType = { id: string; name: string; encashmentAllowed: boolean };

type EncashmentRequest = {
  id: string;
  leaveTypeId: string;
  leaveType: string | null;
  year: number;
  daysRequested: number;
  reason: string | null;
  status: string;
  managerComment: string | null;
  createdAt: string;
};

const currentYear = new Date().getFullYear();

export default function LeaveEncashmentPage() {
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [requests, setRequests] = useState<EncashmentRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const [leaveTypeId, setLeaveTypeId] = useState("");
  const [year, setYear] = useState(String(currentYear));
  const [days, setDays] = useState("1");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState("");

  async function loadAll() {
    try {
      setLoading(true);
      const [typesRes, reqRes] = await Promise.all([
        fetch("/api/leave-types"),
        fetch("/api/employee/leave-encashment"),
      ]);
      if (typesRes.ok) {
        const d = await typesRes.json();
        setLeaveTypes(Array.isArray(d) ? d.filter((t: LeaveType) => t.encashmentAllowed) : []);
      }
      if (reqRes.ok) {
        const d = await reqRes.json();
        setRequests(Array.isArray(d) ? d : []);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!leaveTypeId || !year || !days) {
      setMsg("Leave type, year and days are required");
      return;
    }
    setSubmitting(true);
    setMsg("");
    try {
      const res = await fetch("/api/employee/leave-encashment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leaveTypeId,
          year: Number(year),
          daysRequested: Number(days),
          reason: reason || null,
        }),
      });
      const d = await res.json();
      if (!res.ok) {
        setMsg(typeof d.error === "string" ? d.error : "Failed to submit request");
      } else {
        setMsg("Encashment request submitted!");
        setDays("1");
        setReason("");
        await loadAll();
      }
    } catch {
      setMsg("Failed to submit request");
    } finally {
      setSubmitting(false);
    }
  }

  const msgIsError = msg.toLowerCase().includes("failed") || msg.toLowerCase().includes("insufficient");

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

      <Card>
        <CardHeader>
          <CardTitle>Apply for Leave Encashment</CardTitle>
        </CardHeader>
        <CardContent>
          {leaveTypes.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No leave types are currently configured for encashment. Check the Rules tab or contact HR.
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-3">
              <div>
                <Label className="mb-1.5">Leave Type</Label>
                <Select value={leaveTypeId || null} onValueChange={(value) => setLeaveTypeId(value ?? "")}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="— Select —" />
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

              <div>
                <Label className="mb-1.5">Year</Label>
                <Input type="number" value={year} onChange={(e) => setYear(e.target.value)} required />
              </div>

              <div>
                <Label className="mb-1.5">Days to Encash</Label>
                <Input type="number" min="1" value={days} onChange={(e) => setDays(e.target.value)} required />
              </div>

              <div className="md:col-span-3">
                <Label className="mb-1.5">Reason (optional)</Label>
                <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} />
              </div>

              {msg && (
                <p className={`text-sm md:col-span-3 ${msgIsError ? "text-destructive" : "text-primary"}`}>
                  {msg}
                </p>
              )}

              <div className="flex justify-end md:col-span-3">
                <Button type="submit" disabled={submitting}>
                  {submitting ? "Submitting…" : "Submit Request"}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>

      <Card className="overflow-hidden p-0">
        <div className="border-b px-6 py-4">
          <h2 className="text-lg font-semibold text-foreground">My Encashment Requests</h2>
        </div>
        {requests.length === 0 ? (
          <EmptyState icon={BanknoteIcon} title="No encashment requests yet" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Year</TableHead>
                <TableHead>Days</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Comment</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium text-foreground">{r.leaveType ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{r.year}</TableCell>
                  <TableCell>{r.daysRequested}</TableCell>
                  <TableCell>
                    <StatusBadge status={r.status} />
                  </TableCell>
                  <TableCell className="text-muted-foreground">{r.managerComment ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
