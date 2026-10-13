"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, IndianRupee, PlayIcon, Receipt } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import {
  DataTablePagination,
  paginate,
} from "@/components/shared/data-table-pagination";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatINR } from "@/lib/format/currency";
import { DownloadIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useIsHr } from "@/hooks/use-is-hr";
import { downloadCsv } from "@/lib/format/csv";
import { DeleteButton } from "@/components/shared/delete-button";
import { formatDate } from "@/lib/format/date";

type PayrollRecord = {
  id: string;
  employeeId: string;
  employeeName: string | null;
  employeeCode: string | null;
  payrollPeriod: string;
  basicSalary: string;
  totalAllowances: string;
  totalDeductions: string;
  netSalary: string;
  status: string;
};

type Payslip = {
  id: string;
  employeeId: string;
  payrollRecordId: string;
  payrollPeriod: string;
  basicSalary: string;
  totalAllowances: string;
  totalDeductions: string;
  netSalary: string;
  generatedAt: string;
};

const PAGE_SIZE = 10;

export default function PayrollPage() {
  const [payroll, setPayroll] = useState<PayrollRecord[]>([]);
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [loading, setLoading] = useState(true);
  const [payrollPage, setPayrollPage] = useState(1);
  const [payslipsPage, setPayslipsPage] = useState(1);

  const isHr = useIsHr();
  const [runOpen, setRunOpen] = useState(false);
  const [runMonth, setRunMonth] = useState(new Date().toISOString().slice(0, 7));
  const [running, setRunning] = useState(false);

  async function runPayroll(e: React.FormEvent) {
    e.preventDefault();
    setRunning(true);

    try {
      const res = await fetch("/api/payroll/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payrollPeriod: runMonth }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(typeof data.error === "string" ? data.error : "Failed to run payroll");
      }

      const notes = [
        data.alreadyPaid ? `${data.alreadyPaid} already paid` : "",
        data.noStructure ? `${data.noStructure} without a salary structure` : "",
      ].filter(Boolean);

      toast.success(
        `Payroll for ${data.payrollPeriod}: ${data.created} payslip${data.created === 1 ? "" : "s"} generated${notes.length ? ` (${notes.join(", ")})` : ""}`,
      );
      setRunOpen(false);
      loadPayroll();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to run payroll");
    } finally {
      setRunning(false);
    }
  }

  async function loadPayroll() {
      try {
        const [payrollResponse, payslipResponse] = await Promise.all([
          fetch("/api/payroll"),
          fetch("/api/payslips"),
        ]);

        if (payrollResponse.ok) {
          const payrollData = await payrollResponse.json();
          setPayroll(Array.isArray(payrollData) ? payrollData : []);
        }

        if (payslipResponse.ok) {
          const payslipData = await payslipResponse.json();
          setPayslips(Array.isArray(payslipData) ? payslipData : []);
        }
      } finally {
        setLoading(false);
      }
  }

  useEffect(() => {
    loadPayroll();
  }, []);

  const processedCount = useMemo(
    () => payroll.filter((record) => record.status === "processed").length,
    [payroll],
  );

  const pagedPayroll = useMemo(
    () => paginate(payroll, payrollPage, PAGE_SIZE),
    [payroll, payrollPage],
  );

  const pagedPayslips = useMemo(
    () => paginate(payslips, payslipsPage, PAGE_SIZE),
    [payslips, payslipsPage],
  );

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Payroll"
        description="Payroll records and employee payslips."
        action={
          <>
          {isHr && (
            <Button onClick={() => setRunOpen(true)}>
              <PlayIcon /> Run payroll
            </Button>
          )}
          <Button
            variant="outline"
            disabled={payroll.length === 0}
            onClick={() =>
              downloadCsv(
                `payroll-${new Date().toISOString().slice(0, 10)}.csv`,
                ["Code", "Employee", "Period", "Basic (INR)", "Allowances (INR)", "Deductions (INR)", "Net (INR)", "Status"],
                payroll.map((r) => [
                  r.employeeCode,
                  r.employeeName,
                  r.payrollPeriod,
                  r.basicSalary,
                  r.totalAllowances,
                  r.totalDeductions,
                  r.netSalary,
                  r.status,
                ]),
              )
            }
          >
            <DownloadIcon />
            Export CSV
          </Button>
          </>
        }
      />

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard
              label="Payroll Records"
              value={payroll.length}
              icon={IndianRupee}
            />

            <StatCard
              label="Payslips"
              value={payslips.length}
              icon={Receipt}
            />

            <StatCard
              label="Processed"
              value={processedCount}
              icon={CheckCircle2}
            />
          </div>

          <Card className="mt-6 overflow-hidden p-0">
            <CardHeader className="border-b px-6 py-5">
              <CardTitle>Payroll Records</CardTitle>
            </CardHeader>

            {payroll.length === 0 ? (
              <EmptyState
                icon={IndianRupee}
                title="No payroll records found"
                description="Payroll records will appear here once processed."
              />
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Period</TableHead>
                      <TableHead>Basic Salary</TableHead>
                      <TableHead>Allowances</TableHead>
                      <TableHead>Deductions</TableHead>
                      <TableHead>Net Salary</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-12"><span className="sr-only">Actions</span></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagedPayroll.map((record) => (
                      <TableRow key={record.id}>
                        <TableCell>
                          <div className="font-medium">{record.employeeName ?? "—"}</div>
                          {record.employeeCode && (
                            <div className="text-xs text-muted-foreground">{record.employeeCode}</div>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {record.payrollPeriod}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatINR(record.basicSalary)}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatINR(record.totalAllowances)}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatINR(record.totalDeductions)}
                        </TableCell>
                        <TableCell className="font-semibold text-foreground">
                          {formatINR(record.netSalary)}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={record.status} />
                        </TableCell>
                        <TableCell className="text-right">
                          <DeleteButton
                            url={`/api/payroll/${record.id}`}
                            itemName="payroll record"
                            title="Delete this payroll record?"
                            description={`${record.employeeName ?? "This employee"}'s ${record.payrollPeriod} payroll and its payslip will be permanently removed.`}
                            onDeleted={loadPayroll}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                <DataTablePagination
                  page={payrollPage}
                  pageSize={PAGE_SIZE}
                  total={payroll.length}
                  onPageChange={setPayrollPage}
                />
              </>
            )}
          </Card>

          <Card className="mt-6 overflow-hidden p-0">
            <CardHeader className="border-b px-6 py-5">
              <CardTitle>Payslips</CardTitle>
            </CardHeader>

            {payslips.length === 0 ? (
              <EmptyState
                icon={Receipt}
                title="No payslips found"
                description="Payslips will appear here once generated."
              />
            ) : (
              <>
                <div className="grid gap-4 p-6 md:grid-cols-2 lg:grid-cols-3">
                  {pagedPayslips.map((payslip) => (
                    <Card key={payslip.id}>
                      <CardContent>
                        <div className="flex items-center justify-between">
                          <p className="text-sm text-muted-foreground">
                            Payroll Period
                          </p>
                          <span className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            render={<a href={`/api/payslips/${payslip.id}/pdf`} download />}
                            aria-label={`Download payslip for ${payslip.payrollPeriod}`}
                          >
                            <DownloadIcon /> PDF
                          </Button>
                          <DeleteButton
                            url={`/api/payslips/${payslip.id}`}
                            itemName="payslip"
                            description="Only the payslip is removed; the payroll record stays."
                            onDeleted={loadPayroll}
                          />
                          </span>
                        </div>

                        <p className="mt-1 font-semibold text-foreground">
                          {payslip.payrollPeriod}
                        </p>

                        <div className="mt-4 space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">
                              Basic
                            </span>
                            <span>{formatINR(payslip.basicSalary)}</span>
                          </div>

                          <div className="flex justify-between">
                            <span className="text-muted-foreground">
                              Allowances
                            </span>
                            <span>{formatINR(payslip.totalAllowances)}</span>
                          </div>

                          <div className="flex justify-between">
                            <span className="text-muted-foreground">
                              Deductions
                            </span>
                            <span>{formatINR(payslip.totalDeductions)}</span>
                          </div>

                          <Separator className="my-2" />

                          <div className="flex justify-between font-bold text-foreground">
                            <span>Net Salary</span>
                            <span>{formatINR(payslip.netSalary)}</span>
                          </div>
                        </div>

                        <p className="mt-4 text-xs text-muted-foreground">
                          Generated:{" "}
                          {formatDate(payslip.generatedAt)}
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                <DataTablePagination
                  page={payslipsPage}
                  pageSize={PAGE_SIZE}
                  total={payslips.length}
                  onPageChange={setPayslipsPage}
                />
              </>
            )}
          </Card>
        </>
      )}

      <Dialog open={runOpen} onOpenChange={setRunOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Run payroll</DialogTitle>
            <DialogDescription>
              Pays every active employee for the month from their salary structure and generates their payslips. Anyone already paid for that month is skipped.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={runPayroll} className="space-y-4">
            <div>
              <Label htmlFor="run-month" className="mb-1.5">Month</Label>
              <Input
                id="run-month"
                type="month"
                required
                value={runMonth}
                onChange={(e) => setRunMonth(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setRunOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={running || !runMonth}>
                {running ? "Running…" : "Run payroll"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
