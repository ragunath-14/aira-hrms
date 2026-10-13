"use client";

import { useEffect, useMemo, useState } from "react";
import { DownloadIcon, PlusIcon, ReceiptIcon } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { EmptyState } from "@/components/shared/empty-state";
import {
  ErrorBanner,
  Pill,
  apiError,
  labelize,
  selectClass,
  shortDate,
  type Tone,
} from "@/components/shared/ui-bits";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatINR } from "@/lib/format/currency";
import { downloadCsv } from "@/lib/format/csv";
import { DeleteButton } from "@/components/shared/delete-button";
import { DataTablePagination, clampPage, paginate } from "@/components/shared/data-table-pagination";

type Claim = {
  id: string;
  employeeName: string;
  employeeCode: string;
  category: string;
  amount: string;
  expenseDate: string;
  description: string | null;
  status: "pending" | "approved" | "rejected" | "paid";
  reviewNote: string | null;
};

const CATEGORIES = ["travel", "food", "accommodation", "equipment", "internet", "other"];
const STATUS_TONE: Record<Claim["status"], Tone> = {
  pending: "amber",
  approved: "blue",
  rejected: "red",
  paid: "green",
};
const FILTERS = ["all", "pending", "approved", "rejected", "paid"] as const;

const PAGE_SIZE = 10;

export function ExpensesView({ isHr }: { isHr: boolean }) {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all");

  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);
  const [form, setForm] = useState({
    category: "travel",
    amount: "",
    expenseDate: new Date().toISOString().slice(0, 10),
    description: "",
  });

  const [review, setReview] = useState<{ claim: Claim; status: "approved" | "rejected" } | null>(null);
  const [note, setNote] = useState("");

  async function load() {
    try {
      setError("");
      const res = await fetch(isHr ? "/api/expenses" : "/api/expenses?mine=1");
      if (!res.ok) throw new Error(await apiError(res, "Failed to load expenses"));
      setClaims(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load expenses");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const shown = useMemo(
    () => (filter === "all" ? claims : claims.filter((c) => c.status === filter)),
    [claims, filter],
  );

  const sum = (s: Claim["status"]) =>
    claims.filter((c) => c.status === s).reduce((n, c) => n + Number(c.amount), 0);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    try {
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          amount: Number(form.amount),
          description: form.description.trim() || null,
        }),
      });

      if (!res.ok) throw new Error(await apiError(res, "Failed to submit claim"));

      toast.success("Claim submitted");
      setShowForm(false);
      setForm({ ...form, amount: "", description: "" });
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to submit claim");
    } finally {
      setSaving(false);
    }
  }

  async function act(id: string, body: object) {
    const res = await fetch(`/api/expenses/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      toast.error(await apiError(res, "Action failed"));
      return false;
    }

    load();
    return true;
  }

  async function withdraw(id: string) {
    const res = await fetch(`/api/expenses/${id}`, { method: "DELETE" });

    if (!res.ok) {
      toast.error(await apiError(res, "Failed to withdraw"));
      return;
    }

    toast.success("Claim withdrawn");
    load();
  }

  async function confirmReview() {
    if (!review) return;

    if (await act(review.claim.id, { status: review.status, reviewNote: note.trim() || null })) {
      toast.success(`Claim ${review.status}`);
      setReview(null);
      setNote("");
    }
  }

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title={isHr ? "Expense Claims" : "My Expenses"}
        description={
          isHr
            ? "Review and reimburse employee expense claims."
            : "Submit expenses for reimbursement and track their status."
        }
        action={
          <>
            {isHr && (
              <Button
                variant="outline"
                disabled={claims.length === 0}
                onClick={() =>
                  downloadCsv(
                    `expenses-${new Date().toISOString().slice(0, 10)}.csv`,
                    ["Code", "Employee", "Category", "Amount (INR)", "Date", "Status", "Description"],
                    claims.map((c) => [
                      c.employeeCode,
                      c.employeeName,
                      c.category,
                      c.amount,
                      c.expenseDate,
                      c.status,
                      c.description,
                    ]),
                  )
                }
              >
                <DownloadIcon /> Export CSV
              </Button>
            )}
            <Button onClick={() => setShowForm(true)}>
              <PlusIcon /> New Claim
            </Button>
          </>
        }
      />

      <ErrorBanner message={error} />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Pending" value={formatINR(sum("pending"))} tone="warning" hint={`${claims.filter((c) => c.status === "pending").length} claims`} />
        <StatCard label="Approved, awaiting payment" value={formatINR(sum("approved"))} tone="neutral" />
        <StatCard label="Paid" value={formatINR(sum("paid"))} tone="positive" />
      </div>

      <div className="mb-4 flex flex-wrap gap-1 rounded-lg border bg-background p-1 sm:w-fit">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => { setFilter(f); setPage(1); }}
            className={`rounded-md px-3 py-1 text-sm font-medium capitalize transition ${
              f === filter ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {loading ? (
        <Skeleton className="h-64 w-full rounded-xl" />
      ) : shown.length === 0 ? (
        <EmptyState
          icon={ReceiptIcon}
          title="No expense claims"
          description={isHr ? "Claims submitted by employees appear here." : "Submit your first claim with New Claim."}
        />
      ) : (
        <Card className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                {isHr && <TableHead>Employee</TableHead>}
                <TableHead>Date</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginate(shown, page, PAGE_SIZE).map((c) => (
                <TableRow key={c.id}>
                  {isHr && (
                    <TableCell>
                      <p className="font-medium">{c.employeeName}</p>
                      <p className="text-xs text-muted-foreground">{c.employeeCode}</p>
                    </TableCell>
                  )}
                  <TableCell className="whitespace-nowrap">{shortDate(c.expenseDate)}</TableCell>
                  <TableCell>
                    <p>{labelize(c.category)}</p>
                    {c.description && (
                      <p className="max-w-xs truncate text-xs text-muted-foreground">{c.description}</p>
                    )}
                    {c.reviewNote && (
                      <p className="max-w-xs truncate text-xs text-muted-foreground">HR: {c.reviewNote}</p>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-medium">{formatINR(c.amount)}</TableCell>
                  <TableCell>
                    <Pill tone={STATUS_TONE[c.status]}>{labelize(c.status)}</Pill>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      {isHr && c.status === "pending" && (
                        <>
                          <Button size="sm" onClick={() => setReview({ claim: c, status: "approved" })}>
                            Approve
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setReview({ claim: c, status: "rejected" })}>
                            Reject
                          </Button>
                        </>
                      )}
                      {isHr && c.status === "approved" && (
                        <Button
                          size="sm"
                          onClick={async () => {
                            if (await act(c.id, { status: "paid" })) toast.success("Marked as paid");
                          }}
                        >
                          Mark paid
                        </Button>
                      )}
                      {isHr && (
                        <DeleteButton
                          url={`/api/expenses/${c.id}`}
                          itemName="expense claim"
                          description={`${c.employeeName}'s ${formatINR(c.amount)} claim will be removed.`}
                          onDeleted={load}
                        />
                      )}
                      {!isHr && c.status === "pending" && (
                        <Button size="sm" variant="outline" onClick={() => withdraw(c.id)}>
                          Withdraw
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <DataTablePagination page={clampPage(page, shown.length, PAGE_SIZE)} pageSize={PAGE_SIZE} total={shown.length} onPageChange={setPage} />
        </Card>
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>New Expense Claim</DialogTitle>
            <DialogDescription>HR reviews it and you are notified of the decision.</DialogDescription>
          </DialogHeader>

          <form onSubmit={submit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="expense-category" className="mb-1.5">Category</Label>
                <select
                  id="expense-category"
                  className={selectClass}
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>{labelize(c)}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="expense-amount" className="mb-1.5">Amount (₹)</Label>
                <Input
                  id="expense-amount"
                  type="number"
                  min="1"
                  step="0.01"
                  required
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="expense-date" className="mb-1.5">Expense date</Label>
              <Input
                id="expense-date"
                type="date"
                required
                max={new Date().toISOString().slice(0, 10)}
                value={form.expenseDate}
                onChange={(e) => setForm({ ...form, expenseDate: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="expense-description" className="mb-1.5">Description</Label>
              <Textarea
                id="expense-description"
                rows={3}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? "Submitting…" : "Submit claim"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!review} onOpenChange={(o) => !o && setReview(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {review?.status === "approved" ? "Approve" : "Reject"} claim
            </DialogTitle>
            <DialogDescription>
              {review && `${review.claim.employeeName} · ${formatINR(review.claim.amount)}`}
            </DialogDescription>
          </DialogHeader>

          <div>
            <Label htmlFor="review-note" className="mb-1.5">Note to employee (optional)</Label>
            <Textarea id="review-note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setReview(null)}>Cancel</Button>
            <Button
              variant={review?.status === "rejected" ? "destructive" : "default"}
              onClick={confirmReview}
            >
              {review?.status === "approved" ? "Approve" : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
