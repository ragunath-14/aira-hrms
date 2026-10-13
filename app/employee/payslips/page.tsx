"use client";

import { useEffect, useMemo, useState } from "react";
import { BanknoteIcon, DownloadIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

import { EmptyState } from "@/components/shared/empty-state";
import {
  DataTablePagination,
  paginate,
} from "@/components/shared/data-table-pagination";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatINR } from "@/lib/format/currency";

type Payslip = {
  id: string;
  payrollPeriod: string;
  basicSalary: string;
  totalAllowances: string;
  totalDeductions: string;
  netSalary: string;
  generatedAt: string;
};

const PAGE_SIZE = 10;

export default function EmployeePayslipsPage() {
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/employee/payslips");
        if (res.ok) {
          const d = await res.json();
          setPayslips(Array.isArray(d) ? d : []);
        }
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  const paged = useMemo(() => paginate(payslips, page, PAGE_SIZE), [payslips, page]);

  if (loading) {
    return <Skeleton className="h-64 w-full" />;
  }

  return (
    <Card className="overflow-hidden p-0">
      <div className="border-b px-6 py-4">
        <h2 className="text-lg font-semibold text-foreground">My Payslips</h2>
      </div>
      {payslips.length === 0 ? (
        <EmptyState icon={BanknoteIcon} title="No payslips" />
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Period</TableHead>
                <TableHead>Basic Salary</TableHead>
                <TableHead>Allowances</TableHead>
                <TableHead>Deductions</TableHead>
                <TableHead>Net Salary</TableHead>
                <TableHead className="text-right">Payslip</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.map((ps) => (
                <TableRow key={ps.id}>
                  <TableCell className="font-medium text-foreground">{ps.payrollPeriod}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatINR(ps.basicSalary)}
                  </TableCell>
                  <TableCell className="text-primary">
                    +{formatINR(ps.totalAllowances)}
                  </TableCell>
                  <TableCell className="text-destructive">
                    -{formatINR(ps.totalDeductions)}
                  </TableCell>
                  <TableCell className="font-bold text-foreground">
                    {formatINR(ps.netSalary)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      render={<a href={`/api/employee/payslips/${ps.id}/pdf`} download />}
                      aria-label={`Download payslip for ${ps.payrollPeriod}`}
                    >
                      <DownloadIcon /> PDF
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <DataTablePagination
            page={page}
            pageSize={PAGE_SIZE}
            total={payslips.length}
            onPageChange={setPage}
          />
        </>
      )}
    </Card>
  );
}
