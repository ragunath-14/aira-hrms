"use client";

import { useEffect, useState } from "react";
import { ClipboardListIcon, DownloadIcon } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { downloadCsv } from "@/lib/format/csv";
import { errorText } from "@/lib/format/error-text";

type Code = "P" | "LT" | "HD" | "A" | "PL" | "UL" | "WO" | "H" | "-" | "";

type Row = {
  employeeId: string;
  code: string;
  name: string;
  codes: Code[];
  present: number;
  late: number;
  halfDays: number;
  absent: number;
  paidLeave: number;
  unpaidLeave: number;
  weeklyOffs: number;
  holidays: number;
};

type Muster = { month: string; days: { day: number; weekday: number }[]; rows: Row[] };

const TONE: Record<Code, string> = {
  P: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  LT: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  HD: "bg-orange-500/15 text-orange-700 dark:text-orange-400",
  A: "bg-rose-500/15 text-rose-700 dark:text-rose-400",
  PL: "bg-sky-500/15 text-sky-700 dark:text-sky-400",
  UL: "bg-purple-500/15 text-purple-700 dark:text-purple-400",
  WO: "bg-muted text-muted-foreground",
  H: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-400",
  "-": "text-muted-foreground",
  "": "",
};

const LEGEND: [Code, string][] = [
  ["P", "Present"],
  ["LT", "Late"],
  ["HD", "Half day"],
  ["A", "Absent"],
  ["PL", "Paid leave"],
  ["UL", "Unpaid leave"],
  ["WO", "Weekly off"],
  ["H", "Holiday"],
];

export default function MusterReportPage() {
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [data, setData] = useState<Muster | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return;

    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError("");
        const res = await fetch(`/api/reports/muster?month=${month}`);
        const body = await res.json();

        if (!res.ok) throw new Error(errorText(body.error, "Failed to load the muster report"));

        if (!cancelled) setData(body);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load the muster report");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [month]);

  function exportCsv() {
    if (!data) return;

    downloadCsv(
      `muster-${data.month}.csv`,
      [
        "Code", "Employee", ...data.days.map((d) => String(d.day)),
        "Present", "Late", "Half days", "Absent", "Paid leave", "Unpaid leave", "Weekly offs", "Holidays",
      ],
      data.rows.map((r) => [
        r.code, r.name, ...r.codes, r.present, r.late, r.halfDays, r.absent, r.paidLeave, r.unpaidLeave, r.weeklyOffs, r.holidays,
      ]),
    );
  }

  const weekdayLetter = ["S", "M", "T", "W", "T", "F", "S"];

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader
        title="Muster Report"
        description="Every employee's attendance for the month, day by day, with leave, weekly offs and holidays."
        action={
          <Button variant="outline" onClick={exportCsv} disabled={!data || data.rows.length === 0}>
            <DownloadIcon /> Export CSV
          </Button>
        }
      />

      <div className="mb-4 max-w-xs">
        <Label htmlFor="mr-month" className="mb-1.5">Month</Label>
        <Input id="mr-month" type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
      </div>

      <div className="mb-4 flex flex-wrap gap-2 text-xs">
        {LEGEND.map(([code, label]) => (
          <span key={code} className="flex items-center gap-1.5">
            <span className={`rounded px-1.5 py-0.5 font-semibold ${TONE[code]}`}>{code}</span>
            {label}
          </span>
        ))}
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      <Card className="overflow-hidden p-0">
        {loading ? (
          <div className="space-y-2 p-6">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-full" />
            ))}
          </div>
        ) : !data || data.rows.length === 0 ? (
          <EmptyState icon={ClipboardListIcon} title="No employees" description="There is nobody to show for this month." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="sticky left-0 z-10 min-w-44 bg-muted/40 px-3 py-2 text-left font-semibold">Employee</th>
                  {data.days.map((d) => (
                    <th key={d.day} className={`min-w-8 px-1 py-1 text-center font-medium ${d.weekday === 0 || d.weekday === 6 ? "text-muted-foreground" : ""}`}>
                      <div>{d.day}</div>
                      <div className="text-[10px] font-normal">{weekdayLetter[d.weekday]}</div>
                    </th>
                  ))}
                  {["P", "LT", "HD", "A", "PL", "UL"].map((h) => (
                    <th key={h} className="min-w-9 border-l px-1 py-2 text-center font-semibold first:border-l">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r) => (
                  <tr key={r.employeeId} className="border-b last:border-0">
                    <td className="sticky left-0 z-10 bg-card px-3 py-1.5">
                      <div className="font-medium text-foreground">{r.name}</div>
                      <div className="text-[10px] text-muted-foreground">{r.code}</div>
                    </td>
                    {r.codes.map((code, i) => (
                      <td key={i} className="px-0.5 py-1 text-center">
                        <span className={`inline-block min-w-6 rounded px-1 py-0.5 font-semibold ${TONE[code]}`}>{code}</span>
                      </td>
                    ))}
                    <td className="border-l px-1 text-center font-semibold">{r.present}</td>
                    <td className="px-1 text-center">{r.late}</td>
                    <td className="px-1 text-center">{r.halfDays}</td>
                    <td className="px-1 text-center text-rose-600">{r.absent}</td>
                    <td className="px-1 text-center">{r.paidLeave}</td>
                    <td className="px-1 text-center">{r.unpaidLeave}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
