"use client";

import { useEffect, useState } from "react";
import { PlayIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { errorText } from "@/lib/format/error-text";
import { formatINR } from "@/lib/format/currency";

type Row =
  | { employeeId: string; name: string; code: string; status: "paid"; net: number }
  | { employeeId: string; name: string; code: string; status: "no_structure" }
  | {
      employeeId: string;
      name: string;
      code: string;
      status: "ready";
      gross: number;
      paidDays: number;
      lopDays: number;
      daysInPeriod: number;
      overtimeHours: number;
      overtimePay: number;
      adjustmentEarnings: number;
      adjustmentDeductions: number;
      loanDeduction: number;
      statutory: number;
      totalDeductions: number;
      net: number;
    };

// Shows what payroll would pay for a month, person by person, before anything
// is saved. "Run payroll" then pays everyone who is ready.
export function PayrollReviewDialog({
  open,
  onOpenChange,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}) {
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [rows, setRows] = useState<Row[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return;

    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");
      setRows(null);

      try {
        const res = await fetch("/api/payroll/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ payrollPeriod: month }),
        });
        const data = await res.json();

        if (!res.ok) throw new Error(errorText(data.error, "Failed to review payroll"));

        if (!cancelled) setRows(data.rows);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to review payroll");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [open, month]);

  const ready = (rows ?? []).filter((r): r is Extract<Row, { status: "ready" }> => r.status === "ready");
  const alreadyPaid = (rows ?? []).filter((r) => r.status === "paid").length;
  const noStructure = (rows ?? []).filter((r) => r.status === "no_structure").length;
  const showDays = ready.some((r) => r.daysInPeriod > 0);
  const showOvertime = ready.some((r) => r.overtimePay > 0);
  const showAdjustments = ready.some((r) => r.adjustmentEarnings > 0 || r.adjustmentDeductions > 0);
  const showLoans = ready.some((r) => r.loanDeduction > 0);
  const totalNet = ready.reduce((total, r) => total + r.net, 0);

  async function run() {
    setRunning(true);

    try {
      const res = await fetch("/api/payroll/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payrollPeriod: month }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(errorText(data.error, "Failed to run payroll"));

      toast.success(`Payroll for ${data.payrollPeriod}: ${data.created} payslip${data.created === 1 ? "" : "s"} generated`);
      onOpenChange(false);
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to run payroll");
    } finally {
      setRunning(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>Review and run payroll</DialogTitle>
          <DialogDescription>
            This is what will be paid, calculated from salary structures, attendance, leave, overtime,
            adjustments and loan instalments. Nothing is saved until you run it. Once a month is run for
            someone, it is final for them.
          </DialogDescription>
        </DialogHeader>

        <div className="max-w-xs">
          <Label htmlFor="review-month" className="mb-1.5">Month</Label>
          <Input id="review-month" type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
        </div>

        {error && (
          <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : rows ? (
          <>
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
              <span><strong className="text-foreground">{ready.length}</strong> ready to pay</span>
              {alreadyPaid > 0 && <span>{alreadyPaid} already paid</span>}
              {noStructure > 0 && <span>{noStructure} without a salary structure</span>}
              <span>Total net pay <strong className="text-foreground">{formatINR(totalNet)}</strong></span>
            </div>

            {ready.length > 0 && (
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      {showDays && <TableHead className="text-right">Paid days</TableHead>}
                      {showDays && <TableHead className="text-right">LOP</TableHead>}
                      {showOvertime && <TableHead className="text-right">Overtime</TableHead>}
                      {showAdjustments && <TableHead className="text-right">Adjustments</TableHead>}
                      {showLoans && <TableHead className="text-right">Loan</TableHead>}
                      <TableHead className="text-right">Gross</TableHead>
                      <TableHead className="text-right">Deductions</TableHead>
                      <TableHead className="text-right">Net pay</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ready.map((r) => (
                      <TableRow key={r.employeeId}>
                        <TableCell>
                          <div className="font-medium">{r.name}</div>
                          <div className="text-xs text-muted-foreground">{r.code}</div>
                        </TableCell>
                        {showDays && (
                          <TableCell className="text-right">
                            {r.daysInPeriod > 0 ? `${r.paidDays} / ${r.daysInPeriod}` : "—"}
                          </TableCell>
                        )}
                        {showDays && (
                          <TableCell className={`text-right ${r.lopDays > 0 ? "font-medium text-destructive" : ""}`}>
                            {r.lopDays}
                          </TableCell>
                        )}
                        {showOvertime && (
                          <TableCell className="text-right">
                            {r.overtimePay > 0 ? `${formatINR(r.overtimePay)} (${r.overtimeHours} h)` : "—"}
                          </TableCell>
                        )}
                        {showAdjustments && (
                          <TableCell className="text-right">
                            {r.adjustmentEarnings > 0 && <div className="text-emerald-600">+{formatINR(r.adjustmentEarnings)}</div>}
                            {r.adjustmentDeductions > 0 && <div className="text-destructive">−{formatINR(r.adjustmentDeductions)}</div>}
                            {r.adjustmentEarnings === 0 && r.adjustmentDeductions === 0 && "—"}
                          </TableCell>
                        )}
                        {showLoans && (
                          <TableCell className="text-right">{r.loanDeduction > 0 ? formatINR(r.loanDeduction) : "—"}</TableCell>
                        )}
                        <TableCell className="text-right">{formatINR(r.gross)}</TableCell>
                        <TableCell className="text-right">{formatINR(r.totalDeductions)}</TableCell>
                        <TableCell className="text-right font-semibold">{formatINR(r.net)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {ready.length === 0 && (
              <p className="rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground">
                Nobody is waiting to be paid for this month.
              </p>
            )}
          </>
        ) : null}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="button" onClick={run} disabled={running || loading || ready.length === 0}>
            <PlayIcon /> {running ? "Running…" : `Run payroll for ${ready.length}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
