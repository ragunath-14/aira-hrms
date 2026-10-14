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
        professionalTax: num(r.professionalTax),
        tds: num(r.tds),
      };
    });

    if (url.searchParams.get("format") === "ecr") {
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
      },
    });
  } catch (error) {
    console.error("GET statutory report error:", error);

    return NextResponse.json({ error: "Failed to build the statutory report" }, { status: 500 });
  }
}
