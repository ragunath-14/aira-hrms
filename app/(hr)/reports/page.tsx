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
          throw new Error(
            data.error || "Failed to load report",
          );
        }

        setReport(data);
      } catch (error) {
        setError(
          error instanceof Error
            ? error.message
            : "Failed to load report",
        );
      } finally {
        setLoading(false);
      }
    }

    loadReport();
  }, []);

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Reports
          </h1>

          <p className="mt-2 text-gray-500">
            HRMS summary and workforce reports.
          </p>
        </div>

        {loading && (
          <p className="text-gray-500">
            Loading reports...
          </p>
        )}

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
            {error}
          </div>
        )}

        {report && (
          <>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              <ReportCard
                title="Total Employees"
                value={report.employees.total}
              />

              <ReportCard
                title="Active Employees"
                value={report.employees.active}
              />

              <ReportCard
                title="Payroll Records"
                value={report.payroll.totalRecords}
              />

              <ReportCard
                title="Pending Leaves"
                value={report.leaveRequests.pending}
              />

              <ReportCard
                title="Approved Leaves"
                value={report.leaveRequests.approved}
              />

              <ReportCard
                title="Rejected Leaves"
                value={report.leaveRequests.rejected}
              />
            </div>

            <section className="mt-8 rounded-xl border bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-gray-900">
                Leave Summary
              </h2>

              <div className="mt-6 grid gap-4 md:grid-cols-3">
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
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}

function ReportCard({
  title,
  value,
}: {
  title: string;
  value: number;
}) {
  return (
    <div className="rounded-xl border bg-white p-6 shadow-sm">
      <p className="text-sm text-gray-500">
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
    <div className="rounded-lg border p-5">
      <p className="text-sm text-gray-500">
        {label}
      </p>

      <p className="mt-2 text-2xl font-bold text-gray-900">
        {value}
      </p>
    </div>
  );
}