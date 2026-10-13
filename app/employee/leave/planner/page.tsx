"use client";

import { useEffect, useState } from "react";
import { CalendarDaysIcon } from "lucide-react";

import { RouteTabs } from "@/components/layout/route-tabs";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
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
import { formatDate } from "@/lib/format/date";

const LEAVE_NAV = [
  { href: "/employee/leave", label: "Overview", exact: true },
  { href: "/employee/leave/planner", label: "Planner" },
  { href: "/employee/leave/encashment", label: "Encashment" },
  { href: "/employee/leave/adjustment", label: "Adjustment" },
  { href: "/employee/leave/ltc", label: "LTC" },
  { href: "/employee/leave/rules", label: "Rules" },
];

type LeaveType = { id: string; name: string };

type LeavePlan = {
  id: string;
  leaveTypeId: string | null;
  leaveType: string | null;
  startDate: string;
  endDate: string;
  note: string | null;
  status: string;
  createdAt: string;
};

export default function LeavePlannerPage() {
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [plans, setPlans] = useState<LeavePlan[]>([]);
  const [loading, setLoading] = useState(true);

  const [leaveTypeId, setLeaveTypeId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState("");
  const [deletingId, setDeletingId] = useState("");

  async function loadAll() {
    try {
      setLoading(true);
      const [typesRes, plansRes] = await Promise.all([
        fetch("/api/leave-types"),
        fetch("/api/employee/leave-plans"),
      ]);
      if (typesRes.ok) {
        const d = await typesRes.json();
        setLeaveTypes(Array.isArray(d) ? d : []);
      }
      if (plansRes.ok) {
        const d = await plansRes.json();
        setPlans(Array.isArray(d) ? d : []);
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
    if (!startDate || !endDate) {
      setMsg("Start and end dates are required");
      return;
    }
    setSubmitting(true);
    setMsg("");
    try {
      const res = await fetch("/api/employee/leave-plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leaveTypeId: leaveTypeId || null,
          startDate,
          endDate,
          note: note || null,
        }),
      });
      const d = await res.json();
      if (!res.ok) {
        setMsg(d.error ?? "Failed to add planned leave");
      } else {
        setMsg("Added to your leave planner.");
        setLeaveTypeId("");
        setStartDate("");
        setEndDate("");
        setNote("");
        await loadAll();
      }
    } catch {
      setMsg("Failed to add planned leave");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/employee/leave-plans/${id}`, { method: "DELETE" });
      if (res.ok) {
        setPlans((prev) => prev.filter((p) => p.id !== id));
      }
    } finally {
      setDeletingId("");
    }
  }

  const msgIsError = msg.toLowerCase().includes("failed");

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
          <CardTitle>Add Leave Planned</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
            <div>
              <Label className="mb-1.5">Leave Type (optional)</Label>
              <Select value={leaveTypeId || null} onValueChange={(value) => setLeaveTypeId(value ?? "")}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="— Not decided yet —" />
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
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
            </div>

            <div>
              <Label className="mb-1.5">End Date</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
            </div>

            <div className="md:col-span-2">
              <Label className="mb-1.5">Note (optional)</Label>
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
            </div>

            {msg && (
              <p className={`text-sm md:col-span-2 ${msgIsError ? "text-destructive" : "text-primary"}`}>
                {msg}
              </p>
            )}

            <div className="flex justify-end md:col-span-2">
              <Button type="submit" disabled={submitting}>
                {submitting ? "Adding…" : "Add to Planner"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="overflow-hidden p-0">
        <div className="border-b px-6 py-4">
          <h2 className="text-lg font-semibold text-foreground">View Planner</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Personal placeholders for leave you intend to take — apply from the Overview tab when ready.
          </p>
        </div>
        {plans.length === 0 ? (
          <EmptyState icon={CalendarDaysIcon} title="Nothing planned yet" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Dates</TableHead>
                <TableHead>Note</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {plans.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium text-foreground">{p.leaveType ?? "Undecided"}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(p.startDate)} → {formatDate(p.endDate)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{p.note ?? "—"}</TableCell>
                  <TableCell>
                    <StatusBadge status={p.status} />
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={deletingId === p.id}
                      onClick={() => handleDelete(p.id)}
                    >
                      Remove
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
