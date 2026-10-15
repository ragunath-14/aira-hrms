"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/layout/page-header";
import { selectClass } from "@/components/shared/ui-bits";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { PAYROLL_RULE_DEFAULTS, type PayrollRules } from "@/lib/config/payroll-rules";
import { errorText } from "@/lib/format/error-text";

const checkbox = "size-4 rounded border-input accent-primary";

const WEEKDAYS = [
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
  { value: 0, label: "Sun" },
];

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

function NumberField({
  id,
  label,
  value,
  onChange,
  suffix,
  disabled,
  step = "1",
  min = "0",
}: {
  id: string;
  label: string;
  value: number;
  onChange: (value: number) => void;
  suffix?: string;
  disabled?: boolean;
  step?: string;
  min?: string;
}) {
  return (
    <div>
      <Label htmlFor={id} className="mb-1.5">{label}</Label>
      <div className="flex items-center gap-2">
        <Input
          id={id}
          type="number"
          min={min}
          step={step}
          disabled={disabled}
          value={Number.isFinite(value) ? value : ""}
          onChange={(e) => onChange(e.target.value === "" ? NaN : Number(e.target.value))}
        />
        {suffix && <span className="shrink-0 text-sm text-muted-foreground">{suffix}</span>}
      </div>
    </div>
  );
}

export default function PayrollRulesPage() {
  const [rules, setRules] = useState<PayrollRules>(PAYROLL_RULE_DEFAULTS);
  const [canEdit, setCanEdit] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const [res, tenantRes] = await Promise.all([fetch("/api/settings/payroll-rules"), fetch("/api/tenant")]);
        const data = await res.json();

        if (!res.ok) throw new Error(errorText(data.error, "Failed to load payroll rules"));

        setRules(data.rules);

        const tenant = await tenantRes.json().catch(() => null);
        setCanEdit(["owner", "admin"].includes(tenant?.membership?.role));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load payroll rules");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  const set = (patch: Partial<PayrollRules>) => setRules((current) => ({ ...current, ...patch }));
  const setOvertime = (patch: Partial<PayrollRules["overtime"]>) =>
    setRules((current) => ({ ...current, overtime: { ...current.overtime, ...patch } }));

  function toggleOff(day: number) {
    set({
      weeklyOffDays: rules.weeklyOffDays.includes(day)
        ? rules.weeklyOffDays.filter((d) => d !== day)
        : [...rules.weeklyOffDays, day],
    });
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      const res = await fetch("/api/settings/payroll-rules", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rules),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(errorText(data.error, "Failed to save payroll rules"));

      setRules(data.rules);
      toast.success("Payroll rules saved");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save payroll rules";
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
        title="Payroll Rules"
        description="How attendance, leave, overtime and late arrivals turn into pay."
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
          <Skeleton className="h-48 w-full rounded-xl" />
          <Skeleton className="h-56 w-full rounded-xl" />
        </div>
      ) : (
        <form onSubmit={save} className="space-y-6">
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-800 dark:text-amber-300">
            These rules apply from the <strong>next payroll run</strong>; payroll already processed is not
            changed. Use <strong>Review</strong> on the Payroll page to see the effect before you run it.
            Everything here is off until you switch it on, so payroll keeps paying the full monthly salary.
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Pay by attendance</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Toggle
                checked={rules.linkAttendance}
                onChange={(linkAttendance) => set({ linkAttendance })}
                label="Reduce pay for days not worked (loss of pay)"
                hint="Salary and allowances are paid only for the days worked, on paid leave, and on weekly offs and holidays. Unpaid leave and absences cost a day's pay."
                disabled={readOnly}
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="pr-basis" className="mb-1.5">A day of salary is</Label>
                  <select
                    id="pr-basis"
                    className={selectClass}
                    value={rules.dayBasis}
                    disabled={readOnly}
                    onChange={(e) => set({ dayBasis: e.target.value as PayrollRules["dayBasis"] })}
                  >
                    <option value="calendar">Monthly pay ÷ calendar days in the month</option>
                    <option value="working">Monthly pay ÷ working days in the month</option>
                  </select>
                </div>

                <div>
                  <p className="mb-1.5 text-sm font-medium text-foreground">Weekly offs</p>
                  <div className="flex flex-wrap gap-2">
                    {WEEKDAYS.map((day) => (
                      <label
                        key={day.value}
                        className={`flex cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1 text-sm ${
                          rules.weeklyOffDays.includes(day.value) ? "border-primary bg-primary/10 text-primary" : ""
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="sr-only"
                          disabled={readOnly}
                          checked={rules.weeklyOffDays.includes(day.value)}
                          onChange={() => toggleOff(day.value)}
                        />
                        {day.label}
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <Toggle
                checked={rules.absentIsLop}
                onChange={(absentIsLop) => set({ absentIsLop })}
                label="A working day with no attendance and no approved leave is loss of pay"
                hint="Turn this off if people are not expected to punch in every day. A day marked Absent always costs pay."
                disabled={readOnly || !rules.linkAttendance}
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <NumberField
                  id="pr-half"
                  label="A half day costs"
                  suffix="day(s) of pay"
                  step="0.25"
                  value={rules.halfDayLopDays}
                  onChange={(halfDayLopDays) => set({ halfDayLopDays })}
                  disabled={readOnly || !rules.linkAttendance}
                />
                <NumberField
                  id="pr-late"
                  label="Late marks that cost one day (0 = off)"
                  suffix="late marks"
                  value={rules.lateMarksPerLop}
                  onChange={(lateMarksPerLop) => set({ lateMarksPerLop })}
                  disabled={readOnly || !rules.linkAttendance}
                />
              </div>

              <p className="text-xs text-muted-foreground">
                Days are counted from attendance records and approved leave. Leave types marked
                <em> Unpaid</em> (Leave → Leave types) cost pay; paid ones do not. Someone who joined
                mid-month is paid from the day they joined. Statutory deductions are worked out on the
                pay actually earned.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Overtime</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Toggle
                checked={rules.overtime.enabled}
                onChange={(enabled) => setOvertime({ enabled })}
                label="Pay overtime"
                hint="Worked out from the hours between check-in and check-out, and added to the month's pay."
                disabled={readOnly}
              />

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <NumberField
                  id="ot-std"
                  label="Standard day"
                  suffix="hours"
                  step="0.5"
                  min="1"
                  value={rules.overtime.standardHours}
                  onChange={(standardHours) => setOvertime({ standardHours })}
                  disabled={readOnly || !rules.overtime.enabled}
                />
                <NumberField
                  id="ot-buffer"
                  label="Grace before overtime"
                  suffix="min"
                  value={rules.overtime.bufferMinutes}
                  onChange={(bufferMinutes) => setOvertime({ bufferMinutes })}
                  disabled={readOnly || !rules.overtime.enabled}
                />
                <div>
                  <Label htmlFor="ot-round" className="mb-1.5">Round down to</Label>
                  <select
                    id="ot-round"
                    className={selectClass}
                    value={rules.overtime.roundMinutes}
                    disabled={readOnly || !rules.overtime.enabled}
                    onChange={(e) => setOvertime({ roundMinutes: Number(e.target.value) as PayrollRules["overtime"]["roundMinutes"] })}
                  >
                    {[1, 15, 30, 45, 60].map((m) => (
                      <option key={m} value={m}>{m} minute{m === 1 ? "" : "s"}</option>
                    ))}
                  </select>
                </div>
                <NumberField
                  id="ot-mult"
                  label="Pay rate"
                  suffix="× hourly"
                  step="0.25"
                  min="1"
                  value={rules.overtime.multiplier}
                  onChange={(multiplier) => setOvertime({ multiplier })}
                  disabled={readOnly || !rules.overtime.enabled}
                />
              </div>

              <Toggle
                checked={rules.overtime.offDayAllHours}
                onChange={(offDayAllHours) => setOvertime({ offDayAllHours })}
                label="Every hour worked on a weekly off or holiday is overtime"
                disabled={readOnly || !rules.overtime.enabled}
              />

              <p className="text-xs text-muted-foreground">
                The hourly rate is the full monthly basic salary ÷ the month&apos;s working days ÷ the
                standard day&apos;s hours.
              </p>
            </CardContent>
          </Card>

          {!readOnly && (
            <div className="flex justify-end">
              <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save rules"}</Button>
            </div>
          )}
        </form>
      )}
    </div>
  );
}
