"use client";

import { useEffect, useMemo, useState } from "react";
import { DownloadIcon } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { selectClass } from "@/components/shared/ui-bits";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { downloadCsv } from "@/lib/format/csv";
import { errorText } from "@/lib/format/error-text";
import { formatINR } from "@/lib/format/currency";

type Cell = string | number | null;

type Column = {
  key: string;
  label: string;
  format?: "money" | "percent" | "hours";
  align?: "left" | "right";
};

type ReportTable = {
  title: string;
  note?: string;
  columns: Column[];
  rows: Record<string, Cell>[];
  totals?: Record<string, Cell>;
};

export type ReportKind = "headcount" | "attendance" | "leave" | "payroll";

const show = (value: Cell, format?: Column["format"]) => {
  if (value === null || value === undefined || value === "") return "—";
  if (format === "money") return formatINR(value);
  if (format === "percent") return `${value}%`;
  if (format === "hours") return `${value} h`;

  return String(value);
};

function TableView({ table }: { table: ReportTable }) {
  const csvName = table.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  return (
    <Card className="mb-6 overflow-hidden p-0">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-6 py-4">
        <div>
          <h3 className="text-base font-semibold text-foreground">{table.title}</h3>
          {table.note && <p className="mt-0.5 text-xs text-muted-foreground">{table.note}</p>}
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={table.rows.length === 0}
          onClick={() =>
            downloadCsv(
              `${csvName}.csv`,
              table.columns.map((c) => c.label),
              [
                ...table.rows.map((row) => table.columns.map((c) => row[c.key] ?? "")),
                ...(table.totals ? [table.columns.map((c) => table.totals?.[c.key] ?? "")] : []),
              ],
            )
          }
        >
          <DownloadIcon /> CSV
        </Button>
      </div>

      {table.rows.length === 0 ? (
        <EmptyState title="Nothing to show" description="No records match these filters." />
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {table.columns.map((c) => (
                  <TableHead key={c.key} className={c.align === "right" ? "text-right" : ""}>
                    {c.label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {table.rows.map((row, index) => (
                <TableRow key={index}>
                  {table.columns.map((c) => (
                    <TableCell key={c.key} className={c.align === "right" ? "text-right" : ""}>
                      {show(row[c.key], c.format)}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
              {table.totals && (
                <TableRow className="bg-muted/40 font-semibold">
                  {table.columns.map((c) => (
                    <TableCell key={c.key} className={c.align === "right" ? "text-right" : ""}>
                      {table.totals?.[c.key] === undefined ? "" : show(table.totals[c.key], c.format)}
                    </TableCell>
                  ))}
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </Card>
  );
}

const thisMonth = () => new Date().toISOString().slice(0, 7);
const yearStart = () => `${new Date().getUTCFullYear()}-01`;

// One of the workforce reports, with its filters. Every figure is computed on
// the server for the signed-in person's company only.
export function AnalyticsReport({ report }: { report: ReportKind }) {
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);
  const [locations, setLocations] = useState<{ id: string; name: string }[]>([]);

  const [departmentId, setDepartmentId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [by, setBy] = useState("department");
  const [month, setMonth] = useState(thisMonth());
  const [year, setYear] = useState(String(new Date().getUTCFullYear()));
  const [from, setFrom] = useState(yearStart());
  const [to, setTo] = useState(thisMonth());

  const [tables, setTables] = useState<ReportTable[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([fetch("/api/departments"), fetch("/api/locations")])
      .then(async ([d, l]) => {
        const departmentsData = d.ok ? await d.json() : [];
        const locationsData = l.ok ? await l.json() : [];

        setDepartments(Array.isArray(departmentsData) ? departmentsData : []);
        setLocations(Array.isArray(locationsData) ? locationsData : []);
      })
      .catch(() => {});
  }, []);

  const query = useMemo(() => {
    const params = new URLSearchParams({ report });

    if (departmentId) params.set("departmentId", departmentId);
    if (locationId) params.set("locationId", locationId);
    if (report === "headcount") params.set("by", by);
    if (report === "attendance") params.set("month", month);
    if (report === "leave") params.set("year", year);
    if (report === "payroll") {
      params.set("from", from);
      params.set("to", to);
    }

    return params.toString();
  }, [report, departmentId, locationId, by, month, year, from, to]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");

      try {
        const res = await fetch(`/api/reports/analytics?${query}`);
        const data = await res.json();

        if (!res.ok) throw new Error(errorText(data.error, "Failed to build the report"));

        if (!cancelled) setTables(data.tables ?? []);
      } catch (err) {
        if (!cancelled) {
          setTables([]);
          setError(err instanceof Error ? err.message : "Failed to build the report");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [query]);

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end gap-4">
        {report === "headcount" && (
          <div>
            <Label htmlFor="an-by" className="mb-1.5">Group by</Label>
            <select id="an-by" className={selectClass} value={by} onChange={(e) => setBy(e.target.value)}>
              <option value="department">Department</option>
              <option value="location">Location</option>
              <option value="designation">Designation</option>
              <option value="status">Status</option>
            </select>
          </div>
        )}

        {report === "attendance" && (
          <div>
            <Label htmlFor="an-month" className="mb-1.5">Month</Label>
            <Input id="an-month" type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
          </div>
        )}

        {report === "leave" && (
          <div>
            <Label htmlFor="an-year" className="mb-1.5">Year</Label>
            <Input id="an-year" type="number" min="2000" max="2100" className="w-28" value={year} onChange={(e) => setYear(e.target.value)} />
          </div>
        )}

        {report === "payroll" && (
          <>
            <div>
              <Label htmlFor="an-from" className="mb-1.5">From</Label>
              <Input id="an-from" type="month" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="an-to" className="mb-1.5">To</Label>
              <Input id="an-to" type="month" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
          </>
        )}

        <div>
          <Label htmlFor="an-dept" className="mb-1.5">Department</Label>
          <select id="an-dept" className={`${selectClass} min-w-44`} value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
            <option value="">All departments</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>

        <div>
          <Label htmlFor="an-loc" className="mb-1.5">Location</Label>
          <select id="an-loc" className={`${selectClass} min-w-44`} value={locationId} onChange={(e) => setLocationId(e.target.value)}>
            <option value="">All locations</option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive" role="alert">
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : (
        tables.map((table) => <TableView key={table.title} table={table} />)
      )}
    </div>
  );
}
