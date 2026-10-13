"use client";

import { useEffect, useState } from "react";
import { PlaneIcon } from "lucide-react";

import { RouteTabs } from "@/components/layout/route-tabs";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { formatINR } from "@/lib/format/currency";

const LEAVE_NAV = [
  { href: "/employee/leave", label: "Overview", exact: true },
  { href: "/employee/leave/planner", label: "Planner" },
  { href: "/employee/leave/encashment", label: "Encashment" },
  { href: "/employee/leave/adjustment", label: "Adjustment" },
  { href: "/employee/leave/ltc", label: "LTC" },
  { href: "/employee/leave/rules", label: "Rules" },
];

type LtcClaim = {
  id: string;
  blockYear: string;
  travelStartDate: string | null;
  travelEndDate: string | null;
  destination: string | null;
  amountClaimed: string;
  status: string;
  managerComment: string | null;
  createdAt: string;
};

export default function LtcStatusPage() {
  const [claims, setClaims] = useState<LtcClaim[]>([]);
  const [loading, setLoading] = useState(true);

  const [blockYear, setBlockYear] = useState("");
  const [travelStartDate, setTravelStartDate] = useState("");
  const [travelEndDate, setTravelEndDate] = useState("");
  const [destination, setDestination] = useState("");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState("");

  async function loadClaims() {
    try {
      setLoading(true);
      const res = await fetch("/api/employee/ltc-claims");
      if (res.ok) {
        const d = await res.json();
        setClaims(Array.isArray(d) ? d : []);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadClaims();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!blockYear || !amount) {
      setMsg("Block year and claim amount are required");
      return;
    }
    setSubmitting(true);
    setMsg("");
    try {
      const res = await fetch("/api/employee/ltc-claims", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          blockYear,
          travelStartDate: travelStartDate || null,
          travelEndDate: travelEndDate || null,
          destination: destination || null,
          amountClaimed: Number(amount),
          reason: reason || null,
        }),
      });
      const d = await res.json();
      if (!res.ok) {
        setMsg(typeof d.error === "string" ? d.error : "Failed to submit claim");
      } else {
        setMsg("LTC claim submitted!");
        setDestination("");
        setAmount("");
        setReason("");
        setTravelStartDate("");
        setTravelEndDate("");
        await loadClaims();
      }
    } catch {
      setMsg("Failed to submit claim");
    } finally {
      setSubmitting(false);
    }
  }

  const msgIsError = msg.toLowerCase().includes("failed") || msg.toLowerCase().includes("required");

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
          <CardTitle>Submit LTC Claim</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-sm text-muted-foreground">
            LTC claims track the travel expense reimbursement only — book the time off itself from
            the Overview tab.
          </p>
          <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-3">
            <div>
              <Label className="mb-1.5">Block Year</Label>
              <Input
                value={blockYear}
                onChange={(e) => setBlockYear(e.target.value)}
                placeholder="e.g. 2026-2027"
                required
              />
            </div>

            <div>
              <Label className="mb-1.5">Travel Start</Label>
              <Input type="date" value={travelStartDate} onChange={(e) => setTravelStartDate(e.target.value)} />
            </div>

            <div>
              <Label className="mb-1.5">Travel End</Label>
              <Input type="date" value={travelEndDate} onChange={(e) => setTravelEndDate(e.target.value)} />
            </div>

            <div>
              <Label className="mb-1.5">Destination</Label>
              <Input value={destination} onChange={(e) => setDestination(e.target.value)} />
            </div>

            <div>
              <Label className="mb-1.5">Amount Claimed (₹)</Label>
              <Input type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} required />
            </div>

            <div className="md:col-span-3">
              <Label className="mb-1.5">Reason / Notes</Label>
              <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} />
            </div>

            {msg && (
              <p className={`text-sm md:col-span-3 ${msgIsError ? "text-destructive" : "text-primary"}`}>
                {msg}
              </p>
            )}

            <div className="flex justify-end md:col-span-3">
              <Button type="submit" disabled={submitting}>
                {submitting ? "Submitting…" : "Submit Claim"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="overflow-hidden p-0">
        <div className="border-b px-6 py-4">
          <h2 className="text-lg font-semibold text-foreground">LTC Status</h2>
        </div>
        {claims.length === 0 ? (
          <EmptyState icon={PlaneIcon} title="No LTC claims yet" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Block Year</TableHead>
                <TableHead>Travel Dates</TableHead>
                <TableHead>Destination</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Comment</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {claims.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium text-foreground">{c.blockYear}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {c.travelStartDate ?? "—"} → {c.travelEndDate ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{c.destination ?? "—"}</TableCell>
                  <TableCell>{formatINR(c.amountClaimed)}</TableCell>
                  <TableCell>
                    <StatusBadge status={c.status} />
                  </TableCell>
                  <TableCell className="text-muted-foreground">{c.managerComment ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
