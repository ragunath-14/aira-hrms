"use client";

import { useEffect, useState } from "react";
import {
  Users,
  UserCheck,
  CalendarCheck,
  CalendarX,
  ClipboardList,
  UserPlus,
  Building2,
  Wallet,
} from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { InsightsPanel } from "@/components/features/insights-panel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatINR } from "@/lib/format/currency";
import { errorText } from "@/lib/format/error-text";

type ReportData = {
  payrollVisible?: boolean;
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
  payroll: {
    totalRecords: number;
    latestPeriod: string | null;
    latestPeriodNetTotal: string;
  };
};


export default function Home() {
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadDashboard() {
      try {
        const response = await fetch("/api/reports");

        if (!response.ok) {
          const result = await response.json();
          throw new Error(errorText(result.error, "Failed to load dashboard"));
        }

        const result = await response.json();
        setData(result);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to load dashboard",
        );
      } finally {
        setLoading(false);
      }
    }

    loadDashboard();
  }, []);

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="HR Dashboard"
        description="Overview of employees, attendance, leave and payroll."
      />

      {error && (
        <div className="mb-6 rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <Skeleton key={index} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Total Employees"
              value={data?.employees.total ?? 0}
              icon={Users}
            />

            <StatCard
              label="Active Employees"
              value={data?.employees.active ?? 0}
              hint={
                data && data.employees.total > 0
                  ? `${Math.round((data.employees.active / data.employees.total) * 100)}% of total`
                  : undefined
              }
              tone="positive"
              icon={UserCheck}
            />

            <StatCard
              label="Present Today"
              value={data?.attendance.presentToday ?? 0}
              hint={
                data && data.employees.active > 0
                  ? `${Math.round((data.attendance.presentToday / data.employees.active) * 100)}% attendance`
                  : undefined
              }
              tone="neutral"
              icon={CalendarCheck}
            />

            <StatCard
              label="Absent Today"
              value={data?.attendance.absentToday ?? 0}
              hint={
                data && data.attendance.absentToday > 0
                  ? "Needs review"
                  : undefined
              }
              tone="warning"
              icon={CalendarX}
            />

            <StatCard
              label="Pending Leave Requests"
              value={data?.leaveRequests.pending ?? 0}
              hint={
                data && data.leaveRequests.pending > 0
                  ? "Awaiting approval"
                  : undefined
              }
              tone="warning"
              icon={ClipboardList}
            />

            <StatCard
              label="New Joiners"
              value={data?.employees.newJoiners ?? 0}
              hint="Last 30 days"
              tone="positive"
              icon={UserPlus}
            />

            <StatCard
              label="Departments"
              value={data?.departments.total ?? 0}
              icon={Building2}
            />

            {data?.payrollVisible !== false && (
              <StatCard
                label="Payroll Summary"
                value={formatINR(
                  Number(data?.payroll.latestPeriodNetTotal ?? 0),
                )}
                hint={
                  data?.payroll.latestPeriod
                    ? `Net pay · ${data.payroll.latestPeriod}`
                    : "No payroll run yet"
                }
                tone="neutral"
                icon={Wallet}
              />
            )}
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Leave Summary</CardTitle>
              </CardHeader>

              <CardContent className="space-y-4">
                <SummaryRow
                  label="Pending"
                  value={data?.leaveRequests.pending ?? 0}
                />

                <SummaryRow
                  label="Approved"
                  value={data?.leaveRequests.approved ?? 0}
                />

                <SummaryRow
                  label="Rejected"
                  value={data?.leaveRequests.rejected ?? 0}
                />
              </CardContent>
            </Card>

            {data?.payrollVisible !== false && (
              <Card>
                <CardHeader>
                  <CardTitle>Payroll</CardTitle>
                </CardHeader>

                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Total payroll records
                  </p>

                  <p className="mt-2 text-3xl font-bold text-foreground">
                    {data?.payroll.totalRecords ?? 0}
                  </p>
                </CardContent>
              </Card>
            )}
          </div>

          <InsightsPanel />
        </>
      )}
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between border-b pb-3 last:border-0 last:pb-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="font-semibold text-foreground">{value}</span>
    </div>
  );
}
