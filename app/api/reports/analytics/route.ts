import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/db";
import { requireRole } from "@/lib/auth/authorization";
import { PAYROLL_PERIOD_PATTERN } from "@/lib/domain/payroll";
import { daysInMonth } from "@/lib/domain/payroll-days";
import { isUuid } from "@/lib/validation/ids";

type Cell = string | number | null;

export type ReportColumn = {
  key: string;
  label: string;
  // How to show the value; numbers default to plain.
  format?: "money" | "percent" | "hours";
  align?: "left" | "right";
};

export type ReportTable = {
  title: string;
  note?: string;
  columns: ReportColumn[];
  rows: Record<string, Cell>[];
  totals?: Record<string, Cell>;
};

const num = (value: unknown) => Number(value ?? 0);
const round = (value: number, digits = 2) => Number(value.toFixed(digits));

// Workforce reports for owner, admin and HR: headcount, attendance, leave and
// payroll cost, each by month or year and optionally one department or
// location. Payroll figures also need the payroll area for people with a
// company role.
export async function GET(request: Request) {
  try {
    const auth = await requireRole(request, ["owner", "admin", "hr"]);

    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const url = new URL(request.url);
    const report = url.searchParams.get("report") ?? "";
    const departmentId = url.searchParams.get("departmentId") || null;
    const locationId = url.searchParams.get("locationId") || null;

    if ((departmentId && !isUuid(departmentId)) || (locationId && !isUuid(locationId))) {
      return NextResponse.json({ error: "Invalid department or location" }, { status: 400 });
    }

    const tenant = auth.tenant.id;
    const inDepartment = departmentId ? sql`and e.department_id = ${departmentId}` : sql``;
    const atLocation = locationId ? sql`and e.location_id = ${locationId}` : sql``;
    const people = sql`e.tenant_id = ${tenant} ${inDepartment} ${atLocation}`;

    const tables: ReportTable[] = [];

    // ------------------------------------------------------------ headcount
    if (report === "headcount") {
      const by = url.searchParams.get("by") ?? "department";
      const dimensions: Record<string, { join: ReturnType<typeof sql>; label: ReturnType<typeof sql>; title: string }> = {
        department: { join: sql`left join departments x on x.id = e.department_id`, label: sql`coalesce(x.name, 'No department')`, title: "Headcount by department" },
        location: { join: sql`left join locations x on x.id = e.location_id`, label: sql`coalesce(x.name, 'No location')`, title: "Headcount by location" },
        designation: { join: sql`left join designations x on x.id = e.designation_id`, label: sql`coalesce(x.name, 'No designation')`, title: "Headcount by designation" },
        status: { join: sql``, label: sql`initcap(replace(e.status, '_', ' '))`, title: "Headcount by status" },
      };
      const dimension = dimensions[by];

      if (!dimension) return NextResponse.json({ error: "Choose department, location, designation or status" }, { status: 400 });

      const result = await db.execute(sql`
        select ${dimension.label} as label,
               count(*)::int as total,
               count(*) filter (where e.status = 'active')::int as active
        from employees e ${dimension.join}
        where ${people}
        group by 1 order by 2 desc, 1`);

      const rows = result.rows as { label: string; total: number; active: number }[];
      const total = rows.reduce((t, r) => t + r.total, 0);

      tables.push({
        title: dimension.title,
        columns: [
          { key: "label", label: by.charAt(0).toUpperCase() + by.slice(1) },
          { key: "total", label: "People", align: "right" },
          { key: "active", label: "Active", align: "right" },
          { key: "share", label: "Share", format: "percent", align: "right" },
        ],
        rows: rows.map((r) => ({ ...r, share: total ? round((r.total / total) * 100, 1) : 0 })),
        totals: { label: "Total", total, active: rows.reduce((t, r) => t + r.active, 0), share: total ? 100 : 0 },
      });

      // Joiners by month, last 12 months.
      const joiners = await db.execute(sql`
        select to_char(e.date_of_joining, 'YYYY-MM') as month, count(*)::int as joiners
        from employees e
        where ${people} and e.date_of_joining >= date_trunc('month', now()) - interval '11 months'
        group by 1`);
      const byMonth = new Map((joiners.rows as { month: string; joiners: number }[]).map((r) => [r.month, r.joiners]));
      const now = new Date();
      const months = Array.from({ length: 12 }, (_, i) => {
        const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (11 - i), 1));
        return d.toISOString().slice(0, 7);
      });

      tables.push({
        title: "New joiners, last 12 months",
        columns: [
          { key: "month", label: "Month" },
          { key: "joiners", label: "Joined", align: "right" },
        ],
        rows: months.map((month) => ({ month, joiners: byMonth.get(month) ?? 0 })),
        totals: { month: "Total", joiners: months.reduce((t, m) => t + (byMonth.get(m) ?? 0), 0) },
      });

      // The full list, for a download.
      const list = await db.execute(sql`
        select e.employee_code as code,
               trim(e.first_name || ' ' || coalesce(e.last_name, '')) as name,
               e.email, coalesce(e.phone, '') as phone,
               coalesce(d.name, '') as department, coalesce(g.name, '') as designation,
               coalesce(l.name, '') as location,
               coalesce(to_char(e.date_of_joining, 'YYYY-MM-DD'), '') as joined,
               e.status
        from employees e
        left join departments d on d.id = e.department_id
        left join designations g on g.id = e.designation_id
        left join locations l on l.id = e.location_id
        where ${people}
        order by e.employee_code`);

      tables.push({
        title: "Employee list",
        note: "Everyone in the filter above. Download it as CSV.",
        columns: [
          { key: "code", label: "Code" },
          { key: "name", label: "Name" },
          { key: "email", label: "Email" },
          { key: "phone", label: "Phone" },
          { key: "department", label: "Department" },
          { key: "designation", label: "Designation" },
          { key: "location", label: "Location" },
          { key: "joined", label: "Joined" },
          { key: "status", label: "Status" },
        ],
        rows: list.rows as Record<string, Cell>[],
      });
    }

    // ----------------------------------------------------------- attendance
    else if (report === "attendance") {
      const month = url.searchParams.get("month") ?? "";

      if (!PAYROLL_PERIOD_PATTERN.test(month)) {
        return NextResponse.json({ error: "Choose a month, written as YYYY-MM" }, { status: 400 });
      }

      const start = `${month}-01`;
      const end = `${month}-${String(daysInMonth(month)).padStart(2, "0")}`;

      const result = await db.execute(sql`
        select e.employee_code as code,
               trim(e.first_name || ' ' || coalesce(e.last_name, '')) as name,
               coalesce(d.name, '') as department,
               count(a.id) filter (where a.status = 'present')::int as present,
               count(a.id) filter (where a.status = 'late')::int as late,
               count(a.id) filter (where a.status = 'half_day')::int as half_day,
               count(a.id) filter (where a.status = 'absent')::int as absent,
               count(a.id) filter (where a.status = 'leave')::int as on_leave,
               count(a.id)::int as recorded,
               coalesce(round(avg(extract(epoch from (a.check_out - a.check_in)) / 3600)::numeric, 2), 0)::float8 as avg_hours
        from employees e
        left join departments d on d.id = e.department_id
        left join attendance a on a.employee_id = e.id and a.attendance_date between ${start} and ${end}
        where ${people} and e.status = 'active'
        group by e.id, d.name
        order by e.employee_code`);

      const rows = (result.rows as Record<string, unknown>[]).map((r) => {
        const worked = num(r.present) + num(r.late) + num(r.half_day) * 0.5;

        return {
          code: r.code as string,
          name: r.name as string,
          department: r.department as string,
          present: num(r.present),
          late: num(r.late),
          half_day: num(r.half_day),
          absent: num(r.absent),
          on_leave: num(r.on_leave),
          recorded: num(r.recorded),
          rate: num(r.recorded) ? round((worked / num(r.recorded)) * 100, 1) : 0,
          avg_hours: num(r.avg_hours),
        };
      });

      const sum = (key: "present" | "late" | "half_day" | "absent" | "on_leave" | "recorded") =>
        rows.reduce((t, r) => t + r[key], 0);
      const worked = sum("present") + sum("late") + sum("half_day") * 0.5;

      tables.push({
        title: `Attendance, ${month}`,
        note: "From recorded attendance. A day with no record is not counted as absent here; the Muster report shows those.",
        columns: [
          { key: "code", label: "Code" },
          { key: "name", label: "Employee" },
          { key: "department", label: "Department" },
          { key: "present", label: "Present", align: "right" },
          { key: "late", label: "Late", align: "right" },
          { key: "half_day", label: "Half days", align: "right" },
          { key: "absent", label: "Absent", align: "right" },
          { key: "on_leave", label: "On leave", align: "right" },
          { key: "recorded", label: "Days recorded", align: "right" },
          { key: "rate", label: "Attendance rate", format: "percent", align: "right" },
          { key: "avg_hours", label: "Avg hours", format: "hours", align: "right" },
        ],
        rows,
        totals: {
          code: "",
          name: "Total",
          department: "",
          present: sum("present"),
          late: sum("late"),
          half_day: sum("half_day"),
          absent: sum("absent"),
          on_leave: sum("on_leave"),
          recorded: sum("recorded"),
          rate: sum("recorded") ? round((worked / sum("recorded")) * 100, 1) : 0,
          avg_hours: null,
        },
      });
    }

    // ---------------------------------------------------------------- leave
    else if (report === "leave") {
      const year = Number(url.searchParams.get("year") ?? new Date().getUTCFullYear());

      if (!Number.isInteger(year) || year < 2000 || year > 2100) {
        return NextResponse.json({ error: "Choose a year" }, { status: 400 });
      }

      const byType = await db.execute(sql`
        select t.name as leave_type,
               count(distinct b.employee_id)::int as employees,
               coalesce(sum(b.allocated_days), 0)::int as allocated,
               coalesce(sum(b.used_days), 0)::int as used,
               coalesce(sum(b.remaining_days), 0)::int as remaining
        from leave_balances b
        join leave_types t on t.id = b.leave_type_id
        join employees e on e.id = b.employee_id
        where ${people} and b.year = ${year}
        group by t.name order by t.name`);

      const typeRows = (byType.rows as Record<string, unknown>[]).map((r) => ({
        leave_type: r.leave_type as string,
        employees: num(r.employees),
        allocated: num(r.allocated),
        used: num(r.used),
        remaining: num(r.remaining),
        used_pct: num(r.allocated) ? round((num(r.used) / num(r.allocated)) * 100, 1) : 0,
      }));
      const tAlloc = typeRows.reduce((t, r) => t + r.allocated, 0);
      const tUsed = typeRows.reduce((t, r) => t + r.used, 0);

      tables.push({
        title: `Leave by type, ${year}`,
        columns: [
          { key: "leave_type", label: "Leave type" },
          { key: "employees", label: "Employees", align: "right" },
          { key: "allocated", label: "Allocated", align: "right" },
          { key: "used", label: "Used", align: "right" },
          { key: "remaining", label: "Remaining", align: "right" },
          { key: "used_pct", label: "Used", format: "percent", align: "right" },
        ],
        rows: typeRows,
        totals: {
          leave_type: "Total",
          employees: null,
          allocated: tAlloc,
          used: tUsed,
          remaining: typeRows.reduce((t, r) => t + r.remaining, 0),
          used_pct: tAlloc ? round((tUsed / tAlloc) * 100, 1) : 0,
        },
      });

      const byEmployee = await db.execute(sql`
        select e.employee_code as code,
               trim(e.first_name || ' ' || coalesce(e.last_name, '')) as name,
               coalesce(d.name, '') as department,
               coalesce(sum(b.allocated_days), 0)::int as allocated,
               coalesce(sum(b.used_days), 0)::int as used,
               coalesce(sum(b.remaining_days), 0)::int as remaining,
               (select count(*)::int from leave_requests r where r.employee_id = e.id and r.status = 'pending') as pending
        from employees e
        left join departments d on d.id = e.department_id
        left join leave_balances b on b.employee_id = e.id and b.year = ${year}
        where ${people} and e.status = 'active'
        group by e.id, d.name
        order by e.employee_code`);

      tables.push({
        title: `Leave by employee, ${year}`,
        columns: [
          { key: "code", label: "Code" },
          { key: "name", label: "Employee" },
          { key: "department", label: "Department" },
          { key: "allocated", label: "Allocated", align: "right" },
          { key: "used", label: "Used", align: "right" },
          { key: "remaining", label: "Remaining", align: "right" },
          { key: "pending", label: "Requests pending", align: "right" },
        ],
        rows: byEmployee.rows as Record<string, Cell>[],
      });
    }

    // -------------------------------------------------------------- payroll
    else if (report === "payroll") {
      // Pay is confidential: someone with a company role needs the payroll
      // area as well as Reports.
      if (auth.customRole && !auth.customRole.permissions.payroll?.includes("view")) {
        return NextResponse.json(
          { error: `Your role "${auth.customRole.name}" does not allow you to view Payroll, salary & loans.` },
          { status: 403 },
        );
      }

      const from = url.searchParams.get("from") ?? "";
      const to = url.searchParams.get("to") ?? "";

      if (!PAYROLL_PERIOD_PATTERN.test(from) || !PAYROLL_PERIOD_PATTERN.test(to) || from > to) {
        return NextResponse.json({ error: "Choose a first and last month (first before last)" }, { status: 400 });
      }

      const monthly = await db.execute(sql`
        select p.payroll_period as month,
               count(*)::int as employees,
               coalesce(sum(p.basic_salary + p.total_allowances), 0)::float8 as gross,
               coalesce(sum(p.total_deductions), 0)::float8 as deductions,
               coalesce(sum(p.net_salary), 0)::float8 as net,
               coalesce(sum(p.pf_employer), 0)::float8 as pf_employer,
               coalesce(sum(p.esi_employer), 0)::float8 as esi_employer,
               coalesce(sum(p.lwf_employer), 0)::float8 as lwf_employer
        from payroll_records p
        join employees e on e.id = p.employee_id
        where ${people} and p.payroll_period between ${from} and ${to}
        group by p.payroll_period order by p.payroll_period`);

      const monthRows = (monthly.rows as Record<string, unknown>[]).map((r) => {
        const cost = num(r.gross) + num(r.pf_employer) + num(r.esi_employer) + num(r.lwf_employer);

        return {
          month: r.month as string,
          employees: num(r.employees),
          gross: round(num(r.gross)),
          deductions: round(num(r.deductions)),
          net: round(num(r.net)),
          employer: round(num(r.pf_employer) + num(r.esi_employer) + num(r.lwf_employer)),
          cost: round(cost),
        };
      });
      const total = (key: "gross" | "deductions" | "net" | "employer" | "cost") =>
        round(monthRows.reduce((t, r) => t + r[key], 0));

      tables.push({
        title: `Payroll cost, ${from} to ${to}`,
        note: "Cost to company is gross pay plus the employer's PF, ESI and LWF.",
        columns: [
          { key: "month", label: "Month" },
          { key: "employees", label: "Employees paid", align: "right" },
          { key: "gross", label: "Gross pay", format: "money", align: "right" },
          { key: "deductions", label: "Deductions", format: "money", align: "right" },
          { key: "net", label: "Net pay", format: "money", align: "right" },
          { key: "employer", label: "Employer contributions", format: "money", align: "right" },
          { key: "cost", label: "Cost to company", format: "money", align: "right" },
        ],
        rows: monthRows,
        totals: {
          month: "Total",
          employees: null,
          gross: total("gross"),
          deductions: total("deductions"),
          net: total("net"),
          employer: total("employer"),
          cost: total("cost"),
        },
      });

      const departmentsResult = await db.execute(sql`
        select coalesce(d.name, 'No department') as department,
               count(distinct p.employee_id)::int as employees,
               coalesce(sum(p.basic_salary + p.total_allowances), 0)::float8 as gross,
               coalesce(sum(p.net_salary), 0)::float8 as net,
               coalesce(sum(p.pf_employer + p.esi_employer + p.lwf_employer), 0)::float8 as employer
        from payroll_records p
        join employees e on e.id = p.employee_id
        left join departments d on d.id = e.department_id
        where ${people} and p.payroll_period between ${from} and ${to}
        group by 1 order by gross desc`);

      tables.push({
        title: "Payroll cost by department",
        columns: [
          { key: "department", label: "Department" },
          { key: "employees", label: "People paid", align: "right" },
          { key: "gross", label: "Gross pay", format: "money", align: "right" },
          { key: "net", label: "Net pay", format: "money", align: "right" },
          { key: "cost", label: "Cost to company", format: "money", align: "right" },
        ],
        rows: (departmentsResult.rows as Record<string, unknown>[]).map((r) => ({
          department: r.department as string,
          employees: num(r.employees),
          gross: round(num(r.gross)),
          net: round(num(r.net)),
          cost: round(num(r.gross) + num(r.employer)),
        })),
      });
    } else {
      return NextResponse.json({ error: "Choose a report: headcount, attendance, leave or payroll" }, { status: 400 });
    }

    return NextResponse.json({ report, tables });
  } catch (error) {
    console.error("GET analytics report error:", error);

    return NextResponse.json({ error: "Failed to build the report" }, { status: 500 });
  }
}
