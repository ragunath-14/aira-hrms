import { and, asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/db";
import { employees } from "@/db/schema/employees";
import { employeeStatutory, payrollRecords } from "@/db/schema/payroll";
import { requireRole } from "@/lib/auth/authorization";
import { resolveStatutory } from "@/lib/config/statutory";
import { PAYROLL_PERIOD_PATTERN } from "@/lib/domain/payroll";
import { splitEmployerPf } from "@/lib/domain/statutory";

const num = (value: string | null | undefined) => Number(value ?? 0);

const csvCell = (value: string | number) => {
  const text = String(value);

  // A name or note starting with = + - @ would be run as a formula in Excel.
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;

  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

const csvFile = (name: string, lines: (string | number)[][]) =>
  new NextResponse("\ufeff" + lines.map((line) => line.map(csvCell).join(",")).join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}"`,
    },
  });

// Month-end statutory figures: what to pay to the PF office, ESIC, the state
// (professional tax) and the income-tax department (TDS), per employee and in
// total. `?format=ecr` returns the PF return as an EPFO ECR text file.
export async function GET(request: Request) {
  try {
    const auth = await requireRole(request, ["owner", "admin", "hr"]);

    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const url = new URL(request.url);
    const period = url.searchParams.get("period") ?? "";

    if (!PAYROLL_PERIOD_PATTERN.test(period)) {
      return NextResponse.json(
        { error: "Choose a month, written as YYYY-MM" },
        { status: 400 },
      );
    }

    const config = resolveStatutory(auth.tenant.settings);

    const records = await db
      .select({
        code: employees.employeeCode,
        firstName: employees.firstName,
        lastName: employees.lastName,
        basic: payrollRecords.basicSalary,
        allowances: payrollRecords.totalAllowances,
        net: payrollRecords.netSalary,
        pfWage: payrollRecords.pfWage,
        pfEmployee: payrollRecords.pfEmployee,
        pfEmployer: payrollRecords.pfEmployer,
        esiWage: payrollRecords.esiWage,
        esiEmployee: payrollRecords.esiEmployee,
        esiEmployer: payrollRecords.esiEmployer,
        lwfEmployee: payrollRecords.lwfEmployee,
        lwfEmployer: payrollRecords.lwfEmployer,
        paidDays: payrollRecords.paidDays,
        daysInPeriod: payrollRecords.daysInPeriod,
        professionalTax: payrollRecords.professionalTax,
        tds: payrollRecords.tds,
        pan: employeeStatutory.pan,
        uan: employeeStatutory.uan,
        esiNumber: employeeStatutory.esiNumber,
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
      .where(
        and(
          eq(payrollRecords.tenantId, auth.tenant.id),
          eq(payrollRecords.payrollPeriod, period),
        ),
      )
      .orderBy(asc(employees.employeeCode));

    const rows = records.map((r) => {
      const split = splitEmployerPf(num(r.pfWage), num(r.pfEmployer), config.pf);

      return {
        code: r.code,
        name: [r.firstName, r.lastName].filter(Boolean).join(" "),
        pan: r.pan ?? "",
        uan: r.uan ?? "",
        esiNumber: r.esiNumber ?? "",
        gross: num(r.basic) + num(r.allowances),
        net: num(r.net),
        pfWage: num(r.pfWage),
        pfEmployee: num(r.pfEmployee),
        pfEmployer: num(r.pfEmployer),
        epsWage: split.epsWage,
        eps: split.eps,
        epf: split.epf,
        esiWage: num(r.esiWage),
        esiEmployee: num(r.esiEmployee),
        esiEmployer: num(r.esiEmployer),
        lwfEmployee: num(r.lwfEmployee),
        lwfEmployer: num(r.lwfEmployer),
        // Days wages were paid for: from attendance when pay follows it, otherwise the whole month.
        daysPaid:
          r.daysInPeriod > 0
            ? Math.ceil(num(r.paidDays))
            : new Date(Date.UTC(Number(period.slice(0, 4)), Number(period.slice(5, 7)), 0)).getUTCDate(),
        professionalTax: num(r.professionalTax),
        tds: num(r.tds),
      };
    });

    const format = url.searchParams.get("format");

    if (format === "esic") {
      const members = rows.filter((r) => r.esiWage > 0 || r.esiEmployee > 0);

      if (members.length === 0) {
        return NextResponse.json({ error: "No ESI was deducted for this month" }, { status: 404 });
      }

      const missing = members.filter((r) => !/^\d{10,17}$/.test(r.esiNumber));

      if (missing.length > 0) {
        return NextResponse.json(
          {
            error: `The ESIC file needs an ESI (IP) number for everyone. Add it for: ${missing
              .slice(0, 5)
              .map((m) => m.name)
              .join(", ")}${missing.length > 5 ? ` and ${missing.length - 5} more` : ""}`,
          },
          { status: 422 },
        );
      }

      return csvFile(`esic-${period}.csv`, [
        [
          "IP Number",
          "IP Name",
          "No of Days for which wages paid/payable during the month",
          "Total Monthly Wages",
          "Reason Code for Zero workings days(numeric only; provide 0 for all other reasons- Click on the link for reasons)",
          "Last Working Day (Format DD/MM/YYYY or DD-MM-YYYY)",
        ],
        ...members.map((r) => [r.esiNumber, r.name, r.daysPaid, r.esiWage.toFixed(2), 0, ""]),
      ]);
    }

    if (format === "pt") {
      const list = rows.filter((r) => r.professionalTax > 0);

      if (list.length === 0) {
        return NextResponse.json({ error: "No professional tax was deducted for this month" }, { status: 404 });
      }

      return csvFile(`professional-tax-${period}.csv`, [
        ["Employee code", "Employee", "State", "Gross pay", "Professional tax"],
        ...list.map((r) => [r.code, r.name, config.pt.state, r.gross.toFixed(2), r.professionalTax.toFixed(2)]),
      ]);
    }

    if (format === "tds") {
      const list = rows.filter((r) => r.tds > 0);

      if (list.length === 0) {
        return NextResponse.json({ error: "No TDS was deducted for this month" }, { status: 404 });
      }

      return csvFile(`tds-${period}.csv`, [
        ["Employee code", "Employee", "PAN", "Gross pay", "TDS deducted"],
        ...list.map((r) => [r.code, r.name, r.pan, r.gross.toFixed(2), r.tds.toFixed(2)]),
      ]);
    }

    if (format === "lwf") {
      const list = rows.filter((r) => r.lwfEmployee > 0 || r.lwfEmployer > 0);

      if (list.length === 0) {
        return NextResponse.json({ error: "No Labour Welfare Fund was deducted for this month" }, { status: 404 });
      }

      return csvFile(`lwf-${period}.csv`, [
        ["Employee code", "Employee", "Employee share", "Employer share"],
        ...list.map((r) => [r.code, r.name, r.lwfEmployee.toFixed(2), r.lwfEmployer.toFixed(2)]),
      ]);
    }

    if (format === "ecr") {
      const members = rows.filter((r) => r.pfEmployee > 0 || r.pfEmployer > 0);

      if (members.length === 0) {
        return NextResponse.json(
          { error: "No provident fund contributions were deducted for this month" },
          { status: 404 },
        );
      }

      const missing = members.filter((r) => !/^\d{12}$/.test(r.uan));

      if (missing.length > 0) {
        return NextResponse.json(
          {
            error: `The PF return needs a UAN for everyone. Add it for: ${missing
              .slice(0, 5)
              .map((m) => m.name)
              .join(", ")}${missing.length > 5 ? ` and ${missing.length - 5} more` : ""}`,
          },
          { status: 422 },
        );
      }

      // UAN#~#NAME#~#GROSS#~#EPF WAGES#~#EPS WAGES#~#EDLI WAGES#~#EPF#~#EPS#~#EPF-EPS DIFF#~#NCP DAYS#~#REFUND
      const whole = (n: number) => String(Math.round(n));
      const body = members
        .map((r) =>
          [
            r.uan,
            r.name,
            whole(r.gross),
            whole(r.pfWage),
            whole(r.epsWage),
            whole(r.epsWage),
            whole(r.pfEmployee),
            whole(r.eps),
            whole(r.epf),
            "0",
            "0",
          ].join("#~#"),
        )
        .join("\n");

      return new NextResponse(body, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Content-Disposition": `attachment; filename="ecr-${period}.txt"`,
        },
      });
    }

    const sum = (pick: (r: (typeof rows)[number]) => number) =>
      Math.round(rows.reduce((total, r) => total + pick(r), 0) * 100) / 100;

    return NextResponse.json({
      period,
      enabled: {
        pf: config.pf.enabled,
        esi: config.esi.enabled,
        pt: config.pt.enabled,
        tds: config.tds.enabled,
        lwf: config.lwf.enabled,
      },
      rows,
      totals: {
        employees: rows.length,
        gross: sum((r) => r.gross),
        pfEmployee: sum((r) => r.pfEmployee),
        pfEmployer: sum((r) => r.pfEmployer),
        eps: sum((r) => r.eps),
        epf: sum((r) => r.epf),
        esiEmployee: sum((r) => r.esiEmployee),
        esiEmployer: sum((r) => r.esiEmployer),
        professionalTax: sum((r) => r.professionalTax),
        tds: sum((r) => r.tds),
        lwfEmployee: sum((r) => r.lwfEmployee),
        lwfEmployer: sum((r) => r.lwfEmployer),
      },
    });
  } catch (error) {
    console.error("GET statutory report error:", error);

    return NextResponse.json({ error: "Failed to build the statutory report" }, { status: 500 });
  }
}
