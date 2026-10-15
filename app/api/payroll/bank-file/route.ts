import { and, asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/db";
import { employeeStatutory, employees, payrollRecords } from "@/db/schema";
import { requireRole } from "@/lib/auth/authorization";
import { logAudit } from "@/lib/domain/audit";
import { PAYROLL_PERIOD_PATTERN } from "@/lib/domain/payroll";

const csv = (value: string | number) => {
  const text = String(value);

  // Names or notes that start with = + - @ would be run as formulas in Excel.
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;

  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

// The month's salary as a bank upload file: one line per person with their
// account, IFSC and net pay. Everyone being paid needs bank details first.
export async function GET(request: Request) {
  try {
    const auth = await requireRole(request, ["owner", "admin", "hr"]);

    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const period = new URL(request.url).searchParams.get("period") ?? "";

    if (!PAYROLL_PERIOD_PATTERN.test(period)) {
      return NextResponse.json({ error: "Choose a month, written as YYYY-MM" }, { status: 400 });
    }

    const rows = await db
      .select({
        firstName: employees.firstName,
        lastName: employees.lastName,
        code: employees.employeeCode,
        net: payrollRecords.netSalary,
        bankName: employeeStatutory.bankName,
        account: employeeStatutory.accountNumber,
        ifsc: employeeStatutory.ifsc,
      })
      .from(payrollRecords)
      .innerJoin(employees, eq(employees.id, payrollRecords.employeeId))
      .leftJoin(
        employeeStatutory,
        and(
          eq(employeeStatutory.employeeId, payrollRecords.employeeId),
          eq(employeeStatutory.tenantId, payrollRecords.tenantId),
        ),
      )
      .where(and(eq(payrollRecords.tenantId, auth.tenant.id), eq(payrollRecords.payrollPeriod, period)))
      .orderBy(asc(employees.employeeCode));

    const payable = rows.filter((row) => Number(row.net) > 0);

    if (payable.length === 0) {
      return NextResponse.json({ error: "No salary to pay for this month. Run payroll first." }, { status: 404 });
    }

    const nameOf = (row: (typeof rows)[number]) => [row.firstName, row.lastName].filter(Boolean).join(" ");
    const missing = payable.filter((row) => !row.account || !row.ifsc);

    if (missing.length > 0) {
      return NextResponse.json(
        {
          error: `Add bank account details (Employees → Statutory) for: ${missing
            .slice(0, 5)
            .map(nameOf)
            .join(", ")}${missing.length > 5 ? ` and ${missing.length - 5} more` : ""}`,
        },
        { status: 422 },
      );
    }

    const narration = `Salary ${period}`;
    const lines = [
      ["Employee code", "Beneficiary name", "Account number", "IFSC", "Bank", "Amount", "Narration"],
      ...payable.map((row) => [
        row.code,
        nameOf(row),
        row.account ?? "",
        row.ifsc ?? "",
        row.bankName ?? "",
        Number(row.net).toFixed(2),
        narration,
      ]),
    ];

    await logAudit({
      tenantId: auth.tenant.id,
      userId: auth.user.id,
      action: "bank_file_downloaded",
      entity: "payroll_run",
      entityId: null,
    });

    // BOM so Excel opens it with the right characters.
    return new NextResponse("﻿" + lines.map((line) => line.map(csv).join(",")).join("\r\n"), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="salary-transfer-${period}.csv"`,
      },
    });
  } catch (error) {
    console.error("Bank file error:", error);

    return NextResponse.json({ error: "Failed to build the bank file" }, { status: 500 });
  }
}
