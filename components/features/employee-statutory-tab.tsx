"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { selectClass } from "@/components/shared/ui-bits";
import { errorText } from "@/lib/format/error-text";

type Form = {
  pan: string;
  uan: string;
  esiNumber: string;
  bankName: string;
  accountNumber: string;
  ifsc: string;
  pfApplicable: boolean;
  esiApplicable: boolean;
  ptApplicable: boolean;
  taxRegime: "new" | "old";
  declaredDeductions: string;
};

const empty: Form = {
  pan: "",
  uan: "",
  esiNumber: "",
  bankName: "",
  accountNumber: "",
  ifsc: "",
  pfApplicable: true,
  esiApplicable: true,
  ptApplicable: true,
  taxRegime: "new",
  declaredDeductions: "0",
};

const checkbox = "size-4 rounded border-input accent-primary";

// PF / ESI / professional tax / TDS details for one employee. Only shown to
// owner, admin and HR. Which schemes actually run is a company setting
// (Settings -> Payroll compliance).
export function EmployeeStatutoryTab({ employeeId }: { employeeId: string }) {
  const [form, setForm] = useState<Form>(empty);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch(`/api/employees/${employeeId}/statutory`);
        const data = await res.json();

        if (!res.ok) throw new Error(errorText(data.error, "Failed to load statutory details"));

        if (!cancelled) {
          setForm({ ...empty, ...data, declaredDeductions: String(data.declaredDeductions ?? 0) });
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load statutory details");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [employeeId]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      const res = await fetch(`/api/employees/${employeeId}/statutory`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          pan: form.pan.trim().toUpperCase(),
          ifsc: form.ifsc.trim().toUpperCase(),
          declaredDeductions: Number(form.declaredDeductions) || 0,
        }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(errorText(data.error, "Failed to save statutory details"));

      toast.success("Statutory details saved");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save statutory details";
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Skeleton className="h-72 w-full rounded-xl" />;

  return (
    <Card>
      <CardContent className="px-6">
        <h2 className="text-lg font-semibold text-foreground">Statutory &amp; tax details</h2>
        <p className="mb-5 mt-1 text-sm text-muted-foreground">
          Used for provident fund, ESI, professional tax and income-tax (TDS) deductions and the
          monthly statutory report. The company decides which of them run in{" "}
          <span className="font-medium text-foreground">Settings → Payroll compliance</span>.
        </p>

        {error && (
          <div className="mb-4 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <form onSubmit={save} className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <Label htmlFor="st-pan" className="mb-1.5">PAN</Label>
              <Input
                id="st-pan"
                placeholder="ABCDE1234F"
                maxLength={10}
                value={form.pan}
                onChange={(e) => setForm({ ...form, pan: e.target.value.toUpperCase() })}
              />
            </div>
            <div>
              <Label htmlFor="st-uan" className="mb-1.5">UAN (provident fund)</Label>
              <Input
                id="st-uan"
                inputMode="numeric"
                placeholder="12 digits"
                maxLength={12}
                value={form.uan}
                onChange={(e) => setForm({ ...form, uan: e.target.value.replace(/\D/g, "") })}
              />
            </div>
            <div>
              <Label htmlFor="st-esi" className="mb-1.5">ESI number</Label>
              <Input
                id="st-esi"
                inputMode="numeric"
                placeholder="10 to 17 digits"
                maxLength={17}
                value={form.esiNumber}
                onChange={(e) => setForm({ ...form, esiNumber: e.target.value.replace(/\D/g, "") })}
              />
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm font-medium text-foreground">Bank account for salary</p>
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <Label htmlFor="st-bank" className="mb-1.5">Bank</Label>
                <Input
                  id="st-bank"
                  placeholder="e.g. HDFC Bank"
                  maxLength={80}
                  value={form.bankName}
                  onChange={(e) => setForm({ ...form, bankName: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="st-account" className="mb-1.5">Account number</Label>
                <Input
                  id="st-account"
                  inputMode="numeric"
                  maxLength={20}
                  value={form.accountNumber}
                  onChange={(e) => setForm({ ...form, accountNumber: e.target.value.replace(/\D/g, "") })}
                />
              </div>
              <div>
                <Label htmlFor="st-ifsc" className="mb-1.5">IFSC</Label>
                <Input
                  id="st-ifsc"
                  placeholder="HDFC0001234"
                  maxLength={11}
                  value={form.ifsc}
                  onChange={(e) => setForm({ ...form, ifsc: e.target.value.toUpperCase() })}
                />
              </div>
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm font-medium text-foreground">Deductions that apply</p>
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  className={checkbox}
                  checked={form.pfApplicable}
                  onChange={(e) => setForm({ ...form, pfApplicable: e.target.checked })}
                />
                Provident fund
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  className={checkbox}
                  checked={form.esiApplicable}
                  onChange={(e) => setForm({ ...form, esiApplicable: e.target.checked })}
                />
                ESI (only while gross pay is within the ESI limit)
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  className={checkbox}
                  checked={form.ptApplicable}
                  onChange={(e) => setForm({ ...form, ptApplicable: e.target.checked })}
                />
                Professional tax
              </label>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="st-regime" className="mb-1.5">Income-tax regime</Label>
              <select
                id="st-regime"
                className={selectClass}
                value={form.taxRegime}
                onChange={(e) => setForm({ ...form, taxRegime: e.target.value as "new" | "old" })}
              >
                <option value="new">New regime (default)</option>
                <option value="old">Old regime (with deductions)</option>
              </select>
            </div>
            {form.taxRegime === "old" && (
              <div>
                <Label htmlFor="st-declared" className="mb-1.5">Declared deductions per year (₹)</Label>
                <Input
                  id="st-declared"
                  type="number"
                  min="0"
                  step="1"
                  value={form.declaredDeductions}
                  onChange={(e) => setForm({ ...form, declaredDeductions: e.target.value })}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  80C, 80D, HRA exemption and similar, as declared by the employee. Provident fund and
                  professional tax are added automatically.
                </p>
              </div>
            )}
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save details"}</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
