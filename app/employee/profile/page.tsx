"use client";

import { useState } from "react";
import { KeyRoundIcon } from "lucide-react";

import { ChangePasswordDialog } from "@/components/shared/change-password-dialog";
import { useEmployee } from "@/components/layout/employee-context";
import { PhotoEditor } from "@/components/shared/employee-photo";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format/date";

export default function EmployeeProfilePage() {
  const { employee, reload } = useEmployee();
  const [passwordOpen, setPasswordOpen] = useState(false);

  if (!employee) return null;

  const fullName = `${employee.firstName}${employee.lastName ? ` ${employee.lastName}` : ""}`;

  const details: { label: string; value: string }[] = [
    { label: "Employee code", value: employee.employeeCode },
    { label: "Work email", value: employee.email },
    { label: "Phone", value: employee.phone || "—" },
    { label: "Department", value: employee.departmentName ?? "—" },
    { label: "Designation", value: employee.designationName ?? "—" },
    { label: "Location", value: employee.locationName ?? "—" },
    { label: "Reports to", value: employee.managerName ?? "—" },
    { label: "Date of joining", value: formatDate(employee.dateOfJoining) },
    { label: "Company", value: employee.companyName },
  ];

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-center gap-5 rounded-2xl border bg-card p-6 shadow-sm">
        <PhotoEditor
          employeeId={employee.id}
          name={fullName}
          photoVersion={employee.photoVersion}
          onChanged={reload}
          className="size-20 rounded-2xl text-3xl"
        />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-bold text-foreground">{fullName}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {[employee.designationName, employee.departmentName].filter(Boolean).join(" · ") || "Employee"}
          </p>
          <span className="mt-2 inline-block rounded-full bg-primary px-3 py-0.5 text-xs font-semibold capitalize text-primary-foreground">
            {employee.status.replace(/_/g, " ")}
          </span>
        </div>
        <Button variant="outline" size="lg" onClick={() => setPasswordOpen(true)}>
          <KeyRoundIcon /> Change password
        </Button>
      </section>

      <section className="rounded-2xl border bg-card p-6 shadow-sm">
        <h2 className="mb-5 text-lg font-bold text-foreground">Employment details</h2>
        <dl className="grid gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
          {details.map(({ label, value }) => (
            <div key={label}>
              <dt className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</dt>
              <dd className="mt-1 break-words text-sm font-medium text-foreground">{value}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-6 text-xs text-muted-foreground">
          To change these details, raise a request with HR from the Help section.
        </p>
      </section>

      <ChangePasswordDialog open={passwordOpen} onOpenChange={setPasswordOpen} />
    </div>
  );
}
