"use client";

import { useEffect, useState } from "react";
import {
  Building2,
  CalendarCheck,
  CalendarX,
  CheckCircle2,
  ClipboardList,
  IndianRupee,
  UserCheck,
  UserPlus,
  Users,
} from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatINR } from "@/lib/format/currency";
import { errorText } from "@/lib/format/error-text";

type ReportData = {
  employees: {
    total: number;
    active: number;
    newJoiners: number;
  };
  attendance: {
    presentToday: number;
    absentToday: number;
  };
  leaveRequests: {
    pending: number;
    approved: number;
    rejected: number;
  };
  departments: {
    total: number;
  };
  payrollVisible?: boolean;
  payroll: {
    totalRecords: number;
    latestPeriod: string | null;
    latestPeriodNetTotal: string;
  };
};

export default function ReportsPage() {
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadReport() {
      try {
        const response = await fetch("/api/reports");

        const data = await response.json();

        if (!response.ok) {
          throw new Error(errorText(data.error, "Failed to load report"));
        }

        setReport(data);
      } catch (error) {
        setError(
          error instanceof Error ? error.message : "Failed to load report",
        );
      } finally {
        setLoading(false);
      }
    }

    loadReport();
  }, []);

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Reports"
        description="HRMS summary and workforce reports."
      />

      {error && (
        <div className="mb-6 rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 9 }).map((_, index) => (
            <Skeleton key={index} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      ) : (
        report && (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <StatCard
                label="Total Employees"
                value={report.employees.total}
                icon={Users}
              />

              <StatCard
                label="Active Employees"
                value={report.employees.active}
                icon={UserCheck}
              />

              <StatCard
                label="New Joiners"
                value={report.employees.newJoiners}
                hint="Last 30 days"
                icon={UserPlus}
              />

              <StatCard
                label="Departments"
                value={report.departments.total}
                icon={Building2}
              />

              <StatCard
                label="Present Today"
                value={report.attendance.presentToday}
                icon={CalendarCheck}
              />

              <StatCard
                label="Absent Today"
                value={report.attendance.absentToday}
                icon={CalendarX}
              />

              {report.payrollVisible !== false && (
                <StatCard
                  label="Payroll Records"
                  value={report.payroll.totalRecords}
                  icon={IndianRupee}
                  hint={
                    report.payroll.latestPeriod
                      ? `Latest period · ${report.payroll.latestPeriod}`
                      : "No payroll run yet"
                  }
                />
              )}

              <StatCard
                label="Pending Leaves"
                value={report.leaveRequests.pending}
                icon={ClipboardList}
              />

              <StatCard
                label="Approved Leaves"
                value={report.leaveRequests.approved}
                icon={CheckCircle2}
              />
            </div>

            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Leave Summary</CardTitle>
                </CardHeader>

                <CardContent className="space-y-4">
                  <SummaryRow
                    label="Pending"
                    value={report.leaveRequests.pending}
                  />

                  <SummaryRow
                    label="Approved"
                    value={report.leaveRequests.approved}
                  />

                  <SummaryRow
                    label="Rejected"
                    value={report.leaveRequests.rejected}
                  />
                </CardContent>
              </Card>

              {report.payrollVisible !== false && (
                <Card>
                  <CardHeader>
                    <CardTitle>Payroll</CardTitle>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    <SummaryRow
                      label="Total records"
                      value={report.payroll.totalRecords}
                    />

                    <SummaryRow
                      label="Latest period"
                      value={report.payroll.latestPeriod ?? "—"}
                    />

                    <SummaryRow
                      label="Latest period net total"
                      value={formatINR(report.payroll.latestPeriodNetTotal)}
                    />
                  </CardContent>
                </Card>
              )}
            </div>
          </>
        )
      )}
    </div>
  );
}

function SummaryRow({
  label,
  value,
}: {
  label: string;
  value: number | string;
}) {
  return (
    <div className="flex items-center justify-between border-b pb-3 last:border-0 last:pb-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="font-semibold text-foreground">{value}</span>
    </div>
  );
}
