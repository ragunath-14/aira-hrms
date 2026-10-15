"use client";

import { useEffect, useState } from "react";
import { PlusIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/layout/page-header";
import { selectClass } from "@/components/shared/ui-bits";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { STATUTORY_DEFAULTS, type PtSlab, type StatutoryConfig } from "@/lib/config/statutory";
import { errorText } from "@/lib/format/error-text";

const checkbox = "size-4 rounded border-input accent-primary";

// Text boxes hold strings; these convert to and from the saved numbers.
type SlabRow = { upTo: string; amount: string };

const toRows = (slabs: PtSlab[]): SlabRow[] =>
  slabs.map((s) => ({ upTo: s.upTo === null ? "" : String(s.upTo), amount: String(s.amount) }));

const fromRows = (rows: SlabRow[]): PtSlab[] =>
  rows.map((r) => ({ upTo: r.upTo.trim() === "" ? null : Number(r.upTo), amount: Number(r.amount) || 0 }));

function Toggle({
  checked,
  onChange,
  label,
  hint,
  disabled,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  hint?: string;
  disabled?: boolean;
}) {
  return (
    <label className="flex items-start gap-3">
      <input
        type="checkbox"
        className={`${checkbox} mt-1`}
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>
        <span className="block text-sm font-medium text-foreground">{label}</span>
        {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
      </span>
    </label>
  );
}

function Rate({
  id,
  label,
  value,
  onChange,
  suffix,
  disabled,
  step = "0.01",
}: {
  id: string;
  label: string;
  value: number;
  onChange: (value: number) => void;
  suffix: string;
  disabled?: boolean;
  step?: string;
}) {
  return (
    <div>
      <Label htmlFor={id} className="mb-1.5">{label}</Label>
      <div className="flex items-center gap-2">
        <Input
          id={id}
          type="number"
          min="0"
          step={step}
          disabled={disabled}
          value={Number.isFinite(value) ? value : ""}
          onChange={(e) => onChange(e.target.value === "" ? NaN : Number(e.target.value))}
        />
        <span className="text-sm text-muted-foreground">{suffix}</span>
      </div>
    </div>
  );
}

export default function PayrollCompliancePage() {
  const [config, setConfig] = useState<StatutoryConfig>(STATUTORY_DEFAULTS);
  const [slabRows, setSlabRows] = useState<SlabRow[]>(toRows(STATUTORY_DEFAULTS.pt.slabs));
  const [presets, setPresets] = useState<Record<string, PtSlab[]>>({});
  const [canEdit, setCanEdit] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const [settingsRes, tenantRes] = await Promise.all([
          fetch("/api/settings/statutory"),
          fetch("/api/tenant"),
        ]);
        const data = await settingsRes.json();

        if (!settingsRes.ok) throw new Error(errorText(data.error, "Failed to load payroll compliance settings"));

        setConfig(data.config);
        setSlabRows(toRows(data.config.pt.slabs));
        setPresets(data.ptPresets ?? {});

        const tenant = await tenantRes.json().catch(() => null);
        setCanEdit(["owner", "admin"].includes(tenant?.membership?.role));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load payroll compliance settings");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  const update = <K extends keyof StatutoryConfig>(key: K, patch: Partial<StatutoryConfig[K]>) =>
    setConfig((current) => ({ ...current, [key]: { ...current[key], ...patch } }));

  function pickState(state: string) {
    update("pt", { state });

    if (presets[state]) setSlabRows(toRows(presets[state]));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      const body: StatutoryConfig = { ...config, pt: { ...config.pt, slabs: fromRows(slabRows) } };
      const res = await fetch("/api/settings/statutory", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(errorText(data.error, "Failed to save payroll compliance settings"));

      setConfig(data.config);
      setSlabRows(toRows(data.config.pt.slabs));
      toast.success("Payroll compliance settings saved");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save payroll compliance settings";
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  const readOnly = !canEdit;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title="Payroll Compliance"
        description="Provident fund, ESI, professional tax and income-tax (TDS) rules used when payroll runs."
      />

      {error && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {!loading && readOnly && (
        <div className="rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground">
          Only the company owner or an admin can change these rules.
        </div>
      )}

      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-40 w-full rounded-xl" />
          <Skeleton className="h-40 w-full rounded-xl" />
          <Skeleton className="h-56 w-full rounded-xl" />
        </div>
      ) : (
        <form onSubmit={save} className="space-y-6">
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-800 dark:text-amber-300">
            These rules apply from the <strong>next payroll run</strong>. Payroll already processed is not
            changed. Rates and slabs are set by law and revised from time to time, so check them against
            the current rules before relying on them. Everything is off until you switch it on.
            <div className="mt-2">
              <strong>Avoid deducting twice:</strong> if you already added a Provident Fund, ESI, professional
              tax or income-tax deduction under <em>Salary Structure → Components</em>, remove it once you
              switch the matching rule on here.
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Provident fund (EPF)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Toggle
                checked={config.pf.enabled}
                onChange={(enabled) => update("pf", { enabled })}
                label="Deduct provident fund"
                hint="Employee share comes off pay; the employer share is reported for payment."
                disabled={readOnly}
              />
              <div className="grid gap-4 sm:grid-cols-3">
                <Rate id="pf-ee" label="Employee share" suffix="% of PF wage" value={config.pf.employeeRate} onChange={(employeeRate) => update("pf", { employeeRate })} disabled={readOnly} />
                <Rate id="pf-er" label="Employer share" suffix="% of PF wage" value={config.pf.employerRate} onChange={(employerRate) => update("pf", { employerRate })} disabled={readOnly} />
                <Rate id="pf-eps" label="Pension (EPS) part of employer share" suffix="%" value={config.pf.epsRate} onChange={(epsRate) => update("pf", { epsRate })} disabled={readOnly} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Rate id="pf-ceiling" label="Monthly wage ceiling" suffix="₹" step="1" value={config.pf.wageCeiling} onChange={(wageCeiling) => update("pf", { wageCeiling })} disabled={readOnly} />
                <div className="flex items-end">
                  <Toggle
                    checked={config.pf.capWage}
                    onChange={(capWage) => update("pf", { capWage })}
                    label="Contribute on the ceiling only"
                    hint="Off means PF is worked out on the full basic salary."
                    disabled={readOnly}
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">PF wage is the employee&apos;s basic salary.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Employees&apos; State Insurance (ESI)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Toggle
                checked={config.esi.enabled}
                onChange={(enabled) => update("esi", { enabled })}
                label="Deduct ESI"
                hint="Applies only in months when gross pay is within the limit. Rounded up to the next rupee."
                disabled={readOnly}
              />
              <div className="grid gap-4 sm:grid-cols-3">
                <Rate id="esi-ee" label="Employee share" suffix="% of gross" value={config.esi.employeeRate} onChange={(employeeRate) => update("esi", { employeeRate })} disabled={readOnly} />
                <Rate id="esi-er" label="Employer share" suffix="% of gross" value={config.esi.employerRate} onChange={(employerRate) => update("esi", { employerRate })} disabled={readOnly} />
                <Rate id="esi-limit" label="Monthly gross limit" suffix="₹" step="1" value={config.esi.grossLimit} onChange={(grossLimit) => update("esi", { grossLimit })} disabled={readOnly} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Professional tax</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Toggle
                checked={config.pt.enabled}
                onChange={(enabled) => update("pt", { enabled })}
                label="Deduct professional tax"
                hint="A fixed amount each month, set by your state according to the employee's monthly gross pay."
                disabled={readOnly}
              />

              <div className="max-w-xs">
                <Label htmlFor="pt-state" className="mb-1.5">State</Label>
                <select
                  id="pt-state"
                  className={selectClass}
                  value={presets[config.pt.state] ? config.pt.state : "Custom"}
                  disabled={readOnly}
                  onChange={(e) => pickState(e.target.value)}
                >
                  {Object.keys(presets).map((state) => (
                    <option key={state} value={state}>{state}</option>
                  ))}
                  <option value="Custom">Custom slabs</option>
                </select>
              </div>

              <div>
                <p className="mb-2 text-sm font-medium text-foreground">Monthly slabs</p>
                <div className="space-y-2">
                  {slabRows.map((row, index) => (
                    <div key={index} className="flex flex-wrap items-center gap-2">
                      <span className="w-24 text-sm text-muted-foreground">
                        {row.upTo === "" ? "And above" : index === 0 ? "Gross up to" : "Up to"}
                      </span>
                      <Input
                        aria-label={`Slab ${index + 1} upper limit`}
                        className="w-36"
                        type="number"
                        min="0"
                        placeholder="no limit"
                        disabled={readOnly}
                        value={row.upTo}
                        onChange={(e) => {
                          update("pt", { state: "Custom" });
                          setSlabRows(slabRows.map((r, i) => (i === index ? { ...r, upTo: e.target.value } : r)));
                        }}
                      />
                      <span className="text-sm text-muted-foreground">tax ₹</span>
                      <Input
                        aria-label={`Slab ${index + 1} tax`}
                        className="w-28"
                        type="number"
                        min="0"
                        step="0.01"
                        disabled={readOnly}
                        value={row.amount}
                        onChange={(e) => {
                          update("pt", { state: "Custom" });
                          setSlabRows(slabRows.map((r, i) => (i === index ? { ...r, amount: e.target.value } : r)));
                        }}
                      />
                      {!readOnly && slabRows.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Remove slab ${index + 1}`}
                          onClick={() => setSlabRows(slabRows.filter((_, i) => i !== index))}
                        >
                          <Trash2Icon />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Leave the upper limit empty on the last slab: it means &ldquo;and above&rdquo;. The slabs
                  for each state are a starting point; confirm them with your state&apos;s current rules.
                </p>
                {!readOnly && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    onClick={() => {
                      update("pt", { state: "Custom" });
                      const limits = slabRows.map((r) => Number(r.upTo)).filter((n) => Number.isFinite(n) && n > 0);
                      const next = (limits.length ? Math.max(...limits) : 0) + 5000;
                      setSlabRows([...slabRows.slice(0, -1), { upTo: String(next), amount: "0" }, ...slabRows.slice(-1)]);
                    }}
                  >
                    <PlusIcon /> Add slab
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Income tax (TDS on salary)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Toggle
                checked={config.tds.enabled}
                onChange={(enabled) => update("tds", { enabled })}
                label="Deduct income tax (TDS)"
                hint="Worked out each month from the year's projected pay, using each employee's tax regime."
                disabled={readOnly}
              />
              <ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground">
                <li>New regime (default) and old regime, with the standard deduction, the section 87A rebate and 4% cess. Rules are those for FY 2025-26 onward.</li>
                <li>Each employee&apos;s regime and declared deductions are set on their profile, under <em>Statutory</em>.</li>
                <li>Surcharge (incomes above ₹50 lakh), income from other sources and perquisites are not included. Review such cases by hand.</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Labour Welfare Fund (LWF)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Toggle
                checked={config.lwf.enabled}
                onChange={(enabled) => update("lwf", { enabled })}
                label="Deduct Labour Welfare Fund"
                hint="A fixed amount, taken only in the months you choose. Rates are set by each state, so enter the amounts for your state."
                disabled={readOnly}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <Rate id="lwf-ee" label="Employee amount" suffix="₹" value={config.lwf.employeeAmount} onChange={(employeeAmount) => update("lwf", { employeeAmount })} disabled={readOnly} />
                <Rate id="lwf-er" label="Employer amount" suffix="₹" value={config.lwf.employerAmount} onChange={(employerAmount) => update("lwf", { employerAmount })} disabled={readOnly} />
              </div>
              <div>
                <p className="mb-2 text-sm font-medium text-foreground">Collected in</p>
                <div className="flex flex-wrap gap-2">
                  {["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"].map((name, index) => {
                    const month = index + 1;
                    const on = config.lwf.months.includes(month);

                    return (
                      <label
                        key={name}
                        className={`flex cursor-pointer items-center rounded-md border px-2.5 py-1 text-sm ${on ? "border-primary bg-primary/10 text-primary" : ""}`}
                      >
                        <input
                          type="checkbox"
                          className="sr-only"
                          disabled={readOnly}
                          checked={on}
                          onChange={() =>
                            update("lwf", {
                              months: on
                                ? config.lwf.months.filter((m) => m !== month)
                                : [...config.lwf.months, month].sort((a, b) => a - b),
                            })
                          }
                        />
                        {name}
                      </label>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>

          {!readOnly && (
            <div className="flex justify-end">
              <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save settings"}</Button>
            </div>
          )}
        </form>
      )}
    </div>
  );
}
