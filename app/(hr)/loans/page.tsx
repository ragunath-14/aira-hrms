"use client";

import { useCallback, useEffect, useState } from "react";
import { HandCoinsIcon, PlusIcon } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/layout/page-header";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { selectClass } from "@/components/shared/ui-bits";
import { DataTablePagination, paginate } from "@/components/shared/data-table-pagination";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { useIsHr } from "@/hooks/use-is-hr";
import { errorText } from "@/lib/format/error-text";
import { formatINR } from "@/lib/format/currency";

type Loan = {
  id: string;
  employee: string;
  code: string;
  kind: "loan" | "advance";
  principal: string;
  installments: number;
  installmentAmount: string;
  startPeriod: string;
  balance: string;
  status: "active" | "closed";
  note: string | null;
};

type Person = { id: string; label: string };

const PAGE_SIZE = 10;

export default function LoansPage() {
  const isHr = useIsHr();
  const [loans, setLoans] = useState<Loan[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [closing, setClosing] = useState<Loan | null>(null);
  const [removing, setRemoving] = useState<Loan | null>(null);
  const [form, setForm] = useState({
    employeeId: "",
    kind: "advance",
    principal: "",
    installments: "3",
    startPeriod: new Date().toISOString().slice(0, 7),
    note: "",
  });

  const load = useCallback(async () => {
    try {
      const [loanRes, peopleRes] = await Promise.all([fetch("/api/loans"), fetch("/api/employees")]);

      if (loanRes.ok) setLoans(await loanRes.json());

      if (peopleRes.ok) {
        const list = await peopleRes.json();

        if (Array.isArray(list)) {
          setPeople(
            list
              .filter((e: { status: string }) => e.status === "active")
              .map((e: { id: string; firstName: string; lastName: string | null; employeeCode: string }) => ({
                id: e.id,
                label: `${e.firstName}${e.lastName ? ` ${e.lastName}` : ""} (${e.employeeCode})`,
              })),
          );
        }
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const emi = Number(form.principal) > 0 && Number(form.installments) > 0
    ? Math.ceil((Number(form.principal) / Number(form.installments)) * 100) / 100
    : 0;

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    try {
      const res = await fetch("/api/loans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: form.employeeId,
          kind: form.kind,
          principal: Number(form.principal),
          installments: Number(form.installments),
          startPeriod: form.startPeriod,
          note: form.note.trim() || null,
        }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(errorText(data.error, "Failed to record the loan"));

      toast.success("Recorded. Payroll will recover it in monthly instalments.");
      setOpen(false);
      setForm({ ...form, principal: "", note: "" });
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to record the loan");
    } finally {
      setSaving(false);
    }
  }

  async function act(loan: Loan, kind: "close" | "delete") {
    try {
      const res =
        kind === "close"
          ? await fetch(`/api/loans/${loan.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "close" }),
            })
          : await fetch(`/api/loans/${loan.id}`, { method: "DELETE" });
      const data = await res.json();

      if (!res.ok) throw new Error(errorText(data.error, "Failed"));

      toast.success(kind === "close" ? "Loan closed" : "Loan deleted");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  }

  const rows = paginate(loans, page, PAGE_SIZE);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Loans & Advances"
        description="Record a loan or salary advance; payroll recovers it in equal monthly instalments until it is paid off."
        action={
          isHr ? (
            <Button
              onClick={() => {
                setForm((f) => ({ ...f, employeeId: f.employeeId || people[0]?.id || "" }));
                setOpen(true);
              }}
            >
              <PlusIcon /> Add loan or advance
            </Button>
          ) : undefined
        }
      />

      <Card className="overflow-hidden p-0">
        {loading ? (
          <div className="space-y-2 p-6">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : loans.length === 0 ? (
          <EmptyState
            icon={HandCoinsIcon}
            title="No loans or advances"
            description="Add one and payroll will take the instalment from each month's pay."
          />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Instalment</TableHead>
                  <TableHead>From</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead><span className="sr-only">Actions</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((loan) => (
                  <TableRow key={loan.id}>
                    <TableCell>
                      <div className="font-medium">{loan.employee}</div>
                      <div className="text-xs text-muted-foreground">{loan.code}</div>
                    </TableCell>
                    <TableCell className="capitalize">{loan.kind}</TableCell>
                    <TableCell className="text-right">{formatINR(loan.principal)}</TableCell>
                    <TableCell className="text-right">
                      {formatINR(loan.installmentAmount)} × {loan.installments}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{loan.startPeriod}</TableCell>
                    <TableCell className="text-right font-semibold">{formatINR(loan.balance)}</TableCell>
                    <TableCell>
                      <StatusBadge status={loan.status} />
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-right">
                      {isHr && loan.status === "active" && (
                        <Button size="sm" variant="outline" onClick={() => setClosing(loan)}>
                          Close
                        </Button>
                      )}
                      {isHr && (
                        <Button size="sm" variant="ghost" className="ml-1" onClick={() => setRemoving(loan)}>
                          Delete
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <DataTablePagination page={page} pageSize={PAGE_SIZE} total={loans.length} onPageChange={setPage} />
          </>
        )}
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add a loan or advance</DialogTitle>
            <DialogDescription>
              Payroll takes one instalment each month from the first month you choose, until the balance reaches zero.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={create} className="space-y-4">
            <div>
              <Label htmlFor="loan-employee" className="mb-1.5">Employee</Label>
              <select
                id="loan-employee"
                required
                className={selectClass}
                value={form.employeeId}
                onChange={(e) => setForm({ ...form, employeeId: e.target.value })}
              >
                {people.map((p) => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
              </select>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="loan-kind" className="mb-1.5">Type</Label>
                <select id="loan-kind" className={selectClass} value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
                  <option value="advance">Salary advance</option>
                  <option value="loan">Loan</option>
                </select>
              </div>
              <div>
                <Label htmlFor="loan-amount" className="mb-1.5">Amount (₹)</Label>
                <Input id="loan-amount" required type="number" min="1" step="0.01" value={form.principal} onChange={(e) => setForm({ ...form, principal: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="loan-installments" className="mb-1.5">Number of instalments</Label>
                <Input id="loan-installments" required type="number" min="1" max="120" step="1" value={form.installments} onChange={(e) => setForm({ ...form, installments: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="loan-start" className="mb-1.5">First recovery month</Label>
                <Input id="loan-start" required type="month" value={form.startPeriod} onChange={(e) => setForm({ ...form, startPeriod: e.target.value })} />
              </div>
            </div>

            <div>
              <Label htmlFor="loan-note" className="mb-1.5">Note (optional)</Label>
              <Input id="loan-note" maxLength={200} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
            </div>

            {emi > 0 && (
              <p className="text-sm text-muted-foreground">
                About <strong className="text-foreground">{formatINR(emi)}</strong> a month for {form.installments} month(s).
              </p>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving || !form.employeeId}>{saving ? "Saving…" : "Record"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!closing}
        onOpenChange={(o) => !o && setClosing(null)}
        title="Close this loan?"
        description={closing ? `${closing.employee}'s ${closing.kind} stops being recovered through payroll. What was already recovered stays on record.` : undefined}
        confirmLabel="Close loan"
        destructive={false}
        onConfirm={() => {
          const target = closing;
          setClosing(null);
          if (target) act(target, "close");
        }}
      />

      <ConfirmDialog
        open={!!removing}
        onOpenChange={(o) => !o && setRemoving(null)}
        title="Delete this loan?"
        description={removing ? `Removes ${removing.employee}'s ${removing.kind} entirely. This only works if no instalment has been taken yet.` : undefined}
        confirmLabel="Delete"
        onConfirm={() => {
          const target = removing;
          setRemoving(null);
          if (target) act(target, "delete");
        }}
      />
    </div>
  );
}
