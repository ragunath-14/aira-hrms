"use client";

import { useEffect, useMemo, useState } from "react";
import { NetworkIcon, UsersIcon, User2Icon, Building2Icon } from "lucide-react";

import { PageHeader } from "@/components/hr/page-header";
import { StatCard } from "@/components/hr/stat-card";
import { StatusBadge } from "@/components/hr/status-badge";
import { EmptyState } from "@/components/hr/empty-state";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

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
        <Card>
          <CardContent className="flex items-center justify-between gap-4 px-4 py-4">
            <div>
              <p className="font-semibold text-foreground">
                {getEmployeeName(employee)}
              </p>

              <p className="mt-1 text-sm text-muted-foreground">
                {employee.employeeCode}
              </p>

              <p className="mt-1 text-sm text-muted-foreground">
                {employee.email}
              </p>
            </div>

            <StatusBadge status={employee.status} />
          </CardContent>
        </Card>

        {reports.length > 0 && (
          <div className="border-l-2 border-border pl-4">
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
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Reporting Structure"
        description="View employee reporting relationships and management hierarchy."
      />

      {error && (
        <div className="mb-6 rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-16 w-full" />
          ))}
        </div>
      ) : employees.length === 0 ? (
        <Card>
          <EmptyState
            icon={NetworkIcon}
            title="No employees found"
            description="Employees and their reporting relationships will appear here."
          />
        </Card>
      ) : (
        <>
          <div className="mb-6 grid gap-6 md:grid-cols-3">
            <StatCard
              label="Total Employees"
              value={employees.length}
              icon={UsersIcon}
            />

            <StatCard
              label="Managers"
              value={managers.length}
              icon={User2Icon}
            />

            <StatCard
              label="Top Level"
              value={topLevelEmployees.length}
              icon={Building2Icon}
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Organization Hierarchy</CardTitle>
              <CardDescription>
                Employees are grouped according to their manager relationship.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              {topLevelEmployees.map((employee) => (
                <EmployeeNode
                  key={employee.id}
                  employee={employee}
                />
              ))}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
