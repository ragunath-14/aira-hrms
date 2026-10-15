"use client";

import { useCallback, useEffect, useState } from "react";
import { PlusIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";

import { selectClass } from "@/components/shared/ui-bits";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { errorText } from "@/lib/format/error-text";
import { formatINR } from "@/lib/format/currency";

type Adjustment = {
  id: string;
  employee: string;
  code: string;
  kind: "earning" | "deduction";
  label: string;
  amount: string;
  locked: boolean;
};

type Person = { id: string; label: string };

// One-off pay changes for a month: a bonus or arrears paid, or an amount
// recovered. They are applied when that month's payroll runs, for one person or
// many at once.
export function PayrollAdjustmentsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [items, setItems] = useState<Adjustment[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [kind, setKind] = useState<"earning" | "deduction">("earning");
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const valid = /^\d{4}-(0[1-9]|1[0-2])$/.test(month);

  const load = useCallback(async () => {
    if (!valid) return;

    try {
      const res = await fetch(`/api/payroll/adjustments?period=${month}`);
      const data = await res.json();

      if (!res.ok) throw new Error(errorText(data.error, "Failed to load adjustments"));

      setItems(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load adjustments");
    }
  }, [month, valid]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  useEffect(() => {
    if (!open || people.length > 0) return;

    fetch("/api/employees")
      .then((r) => (r.ok ? r.json() : []))
      .then((list) => {
        if (!Array.isArray(list)) return;

        setPeople(
          list
            .filter((e: { status: string }) => e.status === "active")
            .map((e: { id: string; firstName: string; lastName: string | null; employeeCode: string }) => ({
              id: e.id,
              label: `${e.firstName}${e.lastName ? ` ${e.lastName}` : ""} (${e.employeeCode})`,
            })),
        );
      })
      .catch(() => {});
  }, [open, people.length]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      const res = await fetch("/api/payroll/adjustments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeIds: selected,
          payrollPeriod: month,
          kind,
          label: label.trim(),
          amount: Number(amount),
        }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(errorText(data.error, "Failed to add the adjustment"));

      toast.success(`Added for ${data.created} employee${data.created === 1 ? "" : "s"}`);
      setLabel("");
      setAmount("");
      setSelected([]);
      await load();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to add the adjustment";
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    try {
      const res = await fetch(`/api/payroll/adjustments/${id}`, { method: "DELETE" });
      const data = await res.json();

      if (!res.ok) throw new Error(errorText(data.error, "Failed to remove the adjustment"));

      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove the adjustment");
    }
  }

  const allSelected = people.length > 0 && selected.length === people.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Bonus, arrears and one-off deductions</DialogTitle>
          <DialogDescription>
            Added to a month&apos;s payroll when it runs. A bonus or arrears payment counts as earnings
            (it is included in gross pay for tax); a deduction comes off net pay. A month that is already
            processed cannot be changed.
          </DialogDescription>
        </DialogHeader>

        <div className="max-w-xs">
          <Label htmlFor="adj-month" className="mb-1.5">Month</Label>
          <Input id="adj-month" type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
        </div>

        {error && (
          <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive" role="alert">
            {error}
          </div>
        )}

        <form onSubmit={add} className="space-y-4 rounded-lg border p-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <Label htmlFor="adj-kind" className="mb-1.5">Type</Label>
              <select id="adj-kind" className={selectClass} value={kind} onChange={(e) => setKind(e.target.value as "earning" | "deduction")}>
                <option value="earning">Bonus / arrears (pay more)</option>
                <option value="deduction">Deduction (recover)</option>
              </select>
            </div>
            <div>
              <Label htmlFor="adj-label" className="mb-1.5">Label</Label>
              <Input id="adj-label" required maxLength={80} placeholder="e.g. Diwali bonus" value={label} onChange={(e) => setLabel(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="adj-amount" className="mb-1.5">Amount (₹)</Label>
              <Input id="adj-amount" required type="number" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <Label>Employees ({selected.length} selected)</Label>
              <button
                type="button"
                className="text-xs font-medium text-primary hover:underline"
                onClick={() => setSelected(allSelected ? [] : people.map((p) => p.id))}
              >
                {allSelected ? "Clear all" : "Select all"}
              </button>
            </div>
            <div className="max-h-44 space-y-1 overflow-y-auto rounded-md border p-2">
              {people.map((p) => (
                <label key={p.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="size-4 rounded border-input accent-primary"
                    checked={selected.includes(p.id)}
                    onChange={(e) =>
                      setSelected(e.target.checked ? [...selected, p.id] : selected.filter((id) => id !== p.id))
                    }
                  />
                  {p.label}
                </label>
              ))}
              {people.length === 0 && <p className="text-sm text-muted-foreground">No active employees.</p>}
            </div>
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={saving || selected.length === 0 || !valid}>
              <PlusIcon /> {saving ? "Adding…" : "Add"}
            </Button>
          </div>
        </form>

        <div>
          <h3 className="mb-2 text-sm font-semibold text-foreground">Added for {valid ? month : "this month"}</h3>
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing added yet.</p>
          ) : (
            <ul className="divide-y rounded-lg border">
              {items.map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                  <span>
                    <span className="font-medium">{item.employee}</span>{" "}
                    <span className="text-muted-foreground">· {item.label}</span>
                    {item.locked && <span className="ml-2 text-xs text-muted-foreground">(processed)</span>}
                  </span>
                  <span className="flex items-center gap-2">
                    <span className={item.kind === "earning" ? "text-emerald-600" : "text-destructive"}>
                      {item.kind === "earning" ? "+" : "−"}
                      {formatINR(item.amount)}
                    </span>
                    {!item.locked && (
                      <Button type="button" variant="ghost" size="icon-sm" aria-label={`Remove ${item.label} for ${item.employee}`} onClick={() => remove(item.id)}>
                        <Trash2Icon />
                      </Button>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
