"use client";

import { useEffect, useMemo, useState } from "react";

type Employee = {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string | null;
  email: string;
  managerId: string | null;
  status: string;
};

export default function ReportingStructurePage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadEmployees() {
      try {
        setLoading(true);
        setError("");

        const response = await fetch("/api/employees");

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.error || "Failed to fetch employees",
          );
        }

        setEmployees(Array.isArray(data) ? data : []);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to fetch employees",
        );
      } finally {
        setLoading(false);
      }
    }

    loadEmployees();
  }, []);

  const managers = useMemo(() => {
    return employees.filter((employee) => {
      return employees.some(
        (child) => child.managerId === employee.id,
      );
    });
  }, [employees]);

  const topLevelEmployees = useMemo(() => {
    return employees.filter(
      (employee) =>
        !employee.managerId ||
        !employees.some(
          (manager) => manager.id === employee.managerId,
        ),
    );
  }, [employees]);

  function getEmployeeName(employee: Employee) {
    return `${employee.firstName}${
      employee.lastName
        ? ` ${employee.lastName}`
        : ""
    }`;
  }

  function getDirectReports(managerId: string) {
    return employees.filter(
      (employee) => employee.managerId === managerId,
    );
  }

  function EmployeeNode({
    employee,
    level = 0,
  }: {
    employee: Employee;
    level?: number;
  }) {
    const reports = getDirectReports(employee.id);

    return (
      <div className={level > 0 ? "ml-8 mt-4" : ""}>
        <div className="rounded-lg border bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-semibold text-gray-900">
                {getEmployeeName(employee)}
              </p>

              <p className="mt-1 text-sm text-gray-500">
                {employee.employeeCode}
              </p>

              <p className="mt-1 text-sm text-gray-500">
                {employee.email}
              </p>
            </div>

            <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600">
              {employee.status}
            </span>
          </div>
        </div>

        {reports.length > 0 && (
          <div className="border-l-2 border-gray-200 pl-4">
            {reports.map((report) => (
              <EmployeeNode
                key={report.id}
                employee={report}
                level={level + 1}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Reporting Structure
          </h1>

          <p className="mt-2 text-gray-500">
            View employee reporting relationships and management hierarchy.
          </p>
        </div>

        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="rounded-xl border bg-white p-8 text-center shadow-sm">
            <p className="text-sm text-gray-500">
              Loading reporting structure...
            </p>
          </div>
        ) : employees.length === 0 ? (
          <div className="rounded-xl border bg-white p-8 text-center shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900">
              No employees found
            </h2>

            <p className="mt-2 text-sm text-gray-500">
              Employees and their reporting relationships will appear here.
            </p>
          </div>
        ) : (
          <>
            <div className="mb-6 grid gap-6 md:grid-cols-3">
              <SummaryCard
                title="Total Employees"
                value={employees.length}
              />

              <SummaryCard
                title="Managers"
                value={managers.length}
              />

              <SummaryCard
                title="Top Level"
                value={topLevelEmployees.length}
              />
            </div>

            <section className="rounded-xl border bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-gray-900">
                Organization Hierarchy
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                Employees are grouped according to their manager relationship.
              </p>

              <div className="mt-6 space-y-4">
                {topLevelEmployees.map((employee) => (
                  <EmployeeNode
                    key={employee.id}
                    employee={employee}
                  />
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}

function SummaryCard({
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

      <p className="mt-2 text-3xl font-bold text-gray-900">
        {value}
      </p>
    </div>
  );
}
  