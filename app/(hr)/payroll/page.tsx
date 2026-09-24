"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, IndianRupee, Receipt } from "lucide-react";

import { PageHeader } from "@/components/hr/page-header";
import { StatCard } from "@/components/hr/stat-card";
import { StatusBadge } from "@/components/hr/status-badge";
import { EmptyState } from "@/components/hr/empty-state";
import {
  DataTablePagination,
  paginate,
} from "@/components/hr/data-table-pagination";
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

type PayrollRecord = {
  id: string;
  employeeId: string;
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

  useEffect(() => {
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
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagedPayroll.map((record) => (
                      <TableRow key={record.id}>
                        <TableCell className="text-muted-foreground">
                          {record.employeeId}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {record.payrollPeriod}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          ₹{record.basicSalary}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          ₹{record.totalAllowances}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          ₹{record.totalDeductions}
                        </TableCell>
                        <TableCell className="font-semibold text-foreground">
                          ₹{record.netSalary}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={record.status} />
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
                        <p className="text-sm text-muted-foreground">
                          Payroll Period
                        </p>

                        <p className="mt-1 font-semibold text-foreground">
                          {payslip.payrollPeriod}
                        </p>

                        <div className="mt-4 space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">
                              Basic
                            </span>
                            <span>₹{payslip.basicSalary}</span>
                          </div>

                          <div className="flex justify-between">
                            <span className="text-muted-foreground">
                              Allowances
                            </span>
                            <span>₹{payslip.totalAllowances}</span>
                          </div>

                          <div className="flex justify-between">
                            <span className="text-muted-foreground">
                              Deductions
                            </span>
                            <span>₹{payslip.totalDeductions}</span>
                          </div>

                          <Separator className="my-2" />

                          <div className="flex justify-between font-bold text-foreground">
                            <span>Net Salary</span>
                            <span>₹{payslip.netSalary}</span>
                          </div>
                        </div>

                        <p className="mt-4 text-xs text-muted-foreground">
                          Generated:{" "}
                          {new Date(payslip.generatedAt).toLocaleDateString()}
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
    </div>
  );
}
