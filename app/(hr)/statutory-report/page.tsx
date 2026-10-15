"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { DownloadIcon, FileTextIcon, SettingsIcon } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { StatCard } from "@/components/shared/stat-card";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
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
import { DataTablePagination, paginate } from "@/components/shared/data-table-pagination";
import { downloadCsv } from "@/lib/format/csv";
import { errorText } from "@/lib/format/error-text";
import { formatINR } from "@/lib/format/currency";

type Row = {
  code: string;
  name: string;
  pan: string;
  uan: string;
  esiNumber: string;
  gross: number;
  net: number;
  pfWage: number;
  pfEmployee: number;
  pfEmployer: number;
  epsWage: number;
  eps: number;
  epf: number;
  esiWage: number;
  esiEmployee: number;
  esiEmployer: number;
  professionalTax: number;
  tds: number;
  lwfEmployee: number;
  lwfEmployer: number;
};

type Report = {
  period: string;
  enabled: { pf: boolean; esi: boolean; pt: boolean; tds: boolean; lwf: boolean };
  rows: Row[];
  totals: {
    employees: number;
    gross: number;
    pfEmployee: number;
    pfEmployer: number;
    eps: number;
    epf: number;
    esiEmployee: number;
    esiEmployer: number;
    professionalTax: number;
    tds: number;
    lwfEmployee: number;
    lwfEmployer: number;
  };
};

const PAGE_SIZE = 10;

export default function StatutoryReportPage() {
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) return;

    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError("");
        const res = await fetch(`/api/payroll/statutory-report?period=${period}`);
        const data = await res.json();

        if (!res.ok) throw new Error(errorText(data.error, "Failed to load the statutory report"));

        if (!cancelled) {
          setReport(data);
          setPage(1);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load the statutory report");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [period]);

  async function downloadFile(format: string, filename: string, failure: string) {
    const res = await fetch(`/api/payroll/statutory-report?period=${period}&format=${format}`);

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      toast.error(errorText(data?.error, failure));
      return;
    }

    const url = URL.createObjectURL(await res.blob());
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  const downloadEcr = () => downloadFile("ecr", `ecr-${period}.txt`, "Could not build the PF return file");

  function exportCsv() {
    if (!report) return;

    downloadCsv(
      `statutory-${report.period}.csv`,
      [
        "Code", "Employee", "PAN", "UAN", "ESI number", "Gross",
        "PF wage", "PF employee", "PF employer", "EPS", "EPF (employer)",
        "ESI wage", "ESI employee", "ESI employer", "Professional tax", "TDS", "LWF employee", "LWF employer", "Net pay",
      ],
      report.rows.map((r) => [
        r.code, r.name, r.pan, r.uan, r.esiNumber, r.gross,
        r.pfWage, r.pfEmployee, r.pfEmployer, r.eps, r.epf,
        r.esiWage, r.esiEmployee, r.esiEmployer, r.professionalTax, r.tds, r.lwfEmployee, r.lwfEmployer, r.net,
      ]),
    );
  }

  const rows = report?.rows ?? [];
  const nothingOn = report && !Object.values(report.enabled).some(Boolean);

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Statutory Report"
        description="Month-end provident fund, ESI, professional tax and TDS: what was deducted and what the company must pay."
        action={
          <>
            <Button variant="outline" onClick={downloadEcr} disabled={!report || !report.enabled.pf || rows.length === 0}>
              <FileTextIcon /> PF return (ECR)
            </Button>
            <Button variant="outline" onClick={exportCsv} disabled={rows.length === 0}>
              <DownloadIcon /> Export CSV
            </Button>
          </>
        }
      />

      <div className="mb-6 flex flex-wrap items-end gap-x-6 gap-y-3">
        <div className="w-full max-w-xs">
          <Label htmlFor="sr-month" className="mb-1.5">Month</Label>
          <Input id="sr-month" type="month" value={period} onChange={(e) => setPeriod(e.target.value)} />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">Filing files:</span>
          <Button size="sm" variant="outline" disabled={!report || rows.length === 0} onClick={() => downloadFile("esic", `esic-${period}.csv`, "Could not build the ESIC file")}>
            <DownloadIcon /> ESIC
          </Button>
          <Button size="sm" variant="outline" disabled={!report || rows.length === 0} onClick={() => downloadFile("pt", `professional-tax-${period}.csv`, "Could not build the professional tax file")}>
            <DownloadIcon /> Professional tax
          </Button>
          <Button size="sm" variant="outline" disabled={!report || rows.length === 0} onClick={() => downloadFile("tds", `tds-${period}.csv`, "Could not build the TDS file")}>
            <DownloadIcon /> TDS
          </Button>
          <Button size="sm" variant="outline" disabled={!report || rows.length === 0} onClick={() => downloadFile("lwf", `lwf-${period}.csv`, "Could not build the LWF file")}>
            <DownloadIcon /> LWF
          </Button>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {nothingOn && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-800 dark:text-amber-300">
          <span>No statutory deductions are switched on, so this month shows none.</span>
          <Button size="sm" variant="outline" render={<Link href="/settings/payroll-compliance" />}>
            <SettingsIcon /> Payroll compliance settings
          </Button>
        </div>
      )}

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      ) : report && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <StatCard
              label="Provident fund to pay"
              value={formatINR(report.totals.pfEmployee + report.totals.pfEmployer)}
              icon={FileTextIcon}
            />
            <StatCard
              label="ESI to pay"
              value={formatINR(report.totals.esiEmployee + report.totals.esiEmployer)}
              icon={FileTextIcon}
            />
            <StatCard label="Professional tax" value={formatINR(report.totals.professionalTax)} icon={FileTextIcon} />
            <StatCard label="TDS deducted" value={formatINR(report.totals.tds)} icon={FileTextIcon} />
            <StatCard
              label="Labour welfare fund"
              value={formatINR(report.totals.lwfEmployee + report.totals.lwfEmployer)}
              icon={FileTextIcon}
            />
          </div>

          <Card className="mt-6 overflow-hidden p-0">
            <CardHeader className="border-b px-6 py-5">
              <CardTitle>
                {report.totals.employees} employee{report.totals.employees === 1 ? "" : "s"} paid in {report.period}
              </CardTitle>
            </CardHeader>

            {rows.length === 0 ? (
              <EmptyState
                icon={FileTextIcon}
                title="No payroll for this month"
                description="Run payroll for the month and the statutory figures will appear here."
              />
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>UAN</TableHead>
                      <TableHead className="text-right">Gross</TableHead>
                      <TableHead className="text-right">PF (employee)</TableHead>
                      <TableHead className="text-right">PF (employer)</TableHead>
                      <TableHead className="text-right">ESI (employee)</TableHead>
                      <TableHead className="text-right">ESI (employer)</TableHead>
                      <TableHead className="text-right">Prof. tax</TableHead>
                      <TableHead className="text-right">TDS</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginate(rows, page, PAGE_SIZE).map((r) => (
                      <TableRow key={r.code}>
                        <TableCell>
                          <div className="font-medium">{r.name}</div>
                          <div className="text-xs text-muted-foreground">{r.code}</div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{r.uan || "—"}</TableCell>
                        <TableCell className="text-right">{formatINR(r.gross)}</TableCell>
                        <TableCell className="text-right">{formatINR(r.pfEmployee)}</TableCell>
                        <TableCell className="text-right">{formatINR(r.pfEmployer)}</TableCell>
                        <TableCell className="text-right">{formatINR(r.esiEmployee)}</TableCell>
                        <TableCell className="text-right">{formatINR(r.esiEmployer)}</TableCell>
                        <TableCell className="text-right">{formatINR(r.professionalTax)}</TableCell>
                        <TableCell className="text-right">{formatINR(r.tds)}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-muted/40 font-semibold">
                      <TableCell>Total</TableCell>
                      <TableCell />
                      <TableCell className="text-right">{formatINR(report.totals.gross)}</TableCell>
                      <TableCell className="text-right">{formatINR(report.totals.pfEmployee)}</TableCell>
                      <TableCell className="text-right">{formatINR(report.totals.pfEmployer)}</TableCell>
                      <TableCell className="text-right">{formatINR(report.totals.esiEmployee)}</TableCell>
                      <TableCell className="text-right">{formatINR(report.totals.esiEmployer)}</TableCell>
                      <TableCell className="text-right">{formatINR(report.totals.professionalTax)}</TableCell>
                      <TableCell className="text-right">{formatINR(report.totals.tds)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>

                <DataTablePagination page={page} pageSize={PAGE_SIZE} total={rows.length} onPageChange={setPage} />
              </>
            )}
          </Card>

          <p className="mt-4 text-xs text-muted-foreground">
            Employer provident fund splits into pension (EPS) {formatINR(report.totals.eps)} and EPF{" "}
            {formatINR(report.totals.epf)}. The ECR file lists the PF members for the month in the EPFO
            upload format; check it on the EPFO portal before filing. Employee deductions are already
            taken out of net pay; the employer shares are a cost to the company on top of it.
          </p>
        </>
      )}
    </div>
  );
}
