"use client";

import { useEffect, useState } from "react";

type ReportData = {
  employees: {
    total: number;
    active: number;
  };
  leaveRequests: {
    pending: number;
    approved: number;
    rejected: number;
  };
  payroll: {
    totalRecords: number;
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
          throw new Error(result.error || "Failed to load dashboard");
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

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 p-8">
        <div className="mx-auto max-w-7xl">
          <h1 className="text-2xl font-bold text-gray-900">
            HR Dashboard
          </h1>

          <p className="mt-4 text-gray-500">
            Loading dashboard...
          </p>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-gray-50 p-8">
        <div className="mx-auto max-w-7xl">
          <h1 className="text-2xl font-bold text-gray-900">
            HR Dashboard
          </h1>

          <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
            {error}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            HR Dashboard
          </h1>

          <p className="mt-2 text-gray-500">
            Overview of employees, leave requests and payroll.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <DashboardCard
            title="Total Employees"
            value={data?.employees.total ?? 0}
          />

          <DashboardCard
            title="Active Employees"
            value={data?.employees.active ?? 0}
          />

          <DashboardCard
            title="Pending Leave Requests"
            value={data?.leaveRequests.pending ?? 0}
          />

          <DashboardCard
            title="Approved Leaves"
            value={data?.leaveRequests.approved ?? 0}
          />

          <DashboardCard
            title="Rejected Leaves"
            value={data?.leaveRequests.rejected ?? 0}
          />

          <DashboardCard
            title="Payroll Records"
            value={data?.payroll.totalRecords ?? 0}
          />
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <section className="rounded-xl border bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900">
              Leave Summary
            </h2>

            <div className="mt-5 space-y-4">
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
            </div>
          </section>

          <section className="rounded-xl border bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900">
              Payroll Summary
            </h2>

            <div className="mt-5">
              <p className="text-sm text-gray-500">
                Total payroll records
              </p>

              <p className="mt-2 text-3xl font-bold text-gray-900">
                {data?.payroll.totalRecords ?? 0}
              </p>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

function DashboardCard({
  title,
  value,
}: {
  title: string;
  value: number;
}) {
  return (
    <div className="rounded-xl border bg-white p-6 shadow-sm">
      <p className="text-sm font-medium text-gray-500">
        {title}
      </p>

      <p className="mt-3 text-3xl font-bold text-gray-900">
        {value}
      </p>
    </div>
  );
}

function SummaryRow({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="flex items-center justify-between border-b pb-3 last:border-0">
      <span className="text-sm text-gray-600">
        {label}
      </span>

      <span className="font-semibold text-gray-900">
        {value}
      </span>
    </div>
  );
}