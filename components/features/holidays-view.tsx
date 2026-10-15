"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDaysIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { errorText } from "@/lib/format/error-text";

type Holiday = {
  id: string;
  name: string;
  date: string;
  type: "public" | "optional" | "company";
  description: string | null;
  locationId: string | null;
};

const TYPE_STYLES: Record<Holiday["type"], string> = {
  public: "bg-primary/10 text-primary",
  optional: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  company: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
};

const TYPE_LABELS: Record<Holiday["type"], string> = {
  public: "Public",
  optional: "Optional",
  company: "Company",
};

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function parts(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  const weekday = new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-IN", {
    weekday: "short",
    timeZone: "UTC",
  });
  return { y, m, d, weekday };
}

export function HolidaysView({ canManage }: { canManage: boolean }) {
  const thisYear = new Date().getFullYear();

  const [year, setYear] = useState(thisYear);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [sites, setSites] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    date: "",
    type: "public",
    description: "",
    locationId: "",
  });

  const [toDelete, setToDelete] = useState<Holiday | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Locations, so a holiday can be limited to one branch (HR only).
  useEffect(() => {
    if (!canManage) return;

    fetch("/api/locations")
      .then((r) => (r.ok ? r.json() : []))
      .then((list) => Array.isArray(list) && setSites(list.map((l: { id: string; name: string }) => ({ id: l.id, name: l.name }))))
      .catch(() => {});
  }, [canManage]);

  async function load(y = year) {
    try {
      setLoading(true);
      setError("");
      const res = await fetch(`/api/holidays?year=${y}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(errorText(data.error, "Failed to load holidays"));
      }

      setHolidays(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load holidays");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(year);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year]);

  const byMonth = useMemo(() => {
    const groups = new Map<number, Holiday[]>();
    holidays.forEach((h) => {
      const m = parts(h.date).m;
      groups.set(m, [...(groups.get(m) ?? []), h]);
    });
    return [...groups.entries()].sort((a, b) => a[0] - b[0]);
  }, [holidays]);

  const today = new Date().toISOString().slice(0, 10);
  const next = holidays.find((h) => h.date >= today);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();

    if (!form.name.trim() || !form.date) {
      toast.error("Name and date are required");
      return;
    }

    setSaving(true);

    try {
      const res = await fetch("/api/holidays", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          date: form.date,
          type: form.type,
          description: form.description.trim() || null,
          locationId: form.locationId || null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(
          typeof data.error === "string" ? data.error : "Failed to add holiday",
        );
      }

      toast.success("Holiday added");
      setShowForm(false);
      setForm({ name: "", date: "", type: "public", description: "", locationId: "" });

      if (Number(form.date.slice(0, 4)) !== year) {
        setYear(Number(form.date.slice(0, 4)));
      } else {
        load();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add holiday");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!toDelete) return;
    setDeleting(true);

    try {
      const res = await fetch(`/api/holidays/${toDelete.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        throw new Error("Failed to delete holiday");
      }

      toast.success("Holiday removed");
      setToDelete(null);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Holiday Calendar"
        description="Company holidays for the year."
        action={
          canManage ? (
            <Button onClick={() => setShowForm(true)}>
              <PlusIcon /> Add Holiday
            </Button>
          ) : undefined
        }
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 rounded-lg border bg-background p-1">
          {[thisYear - 1, thisYear, thisYear + 1].map((y) => (
            <button
              key={y}
              type="button"
              onClick={() => setYear(y)}
              className={`rounded-md px-3 py-1 text-sm font-medium transition ${
                y === year
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {y}
            </button>
          ))}
        </div>

        {next && year === thisYear && (
          <p className="text-sm text-muted-foreground">
            Next: <span className="font-medium text-foreground">{next.name}</span>{" "}
            on {parts(next.date).d} {MONTHS[parts(next.date).m - 1].slice(0, 3)}
          </p>
        )}
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      ) : byMonth.length === 0 ? (
        <EmptyState
          icon={CalendarDaysIcon}
          title={`No holidays for ${year}`}
          description={
            canManage
              ? "Add the company's public, optional and company holidays."
              : "HR hasn't published holidays for this year yet."
          }
        />
      ) : (
        <div className="space-y-6">
          {byMonth.map(([month, items]) => (
            <section key={month}>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {MONTHS[month - 1]}
              </h2>

              <Card className="divide-y overflow-hidden p-0">
                {items.map((h) => {
                  const p = parts(h.date);
                  const past = h.date < today;

                  return (
                    <div
                      key={h.id}
                      className={`flex items-center gap-4 px-4 py-3 ${past ? "opacity-60" : ""}`}
                    >
                      <div className="flex size-12 shrink-0 flex-col items-center justify-center rounded-lg bg-muted">
                        <span className="text-lg font-bold leading-none">
                          {p.d}
                        </span>
                        <span className="mt-0.5 text-[10px] font-medium uppercase text-muted-foreground">
                          {p.weekday}
                        </span>
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">
                          {h.name}
                        </p>
                        {h.description && (
                          <p className="truncate text-xs text-muted-foreground">
                            {h.description}
                          </p>
                        )}
                        {h.locationId && (
                          <p className="truncate text-xs text-muted-foreground">
                            Only at {sites.find((x) => x.id === h.locationId)?.name ?? "one location"}
                          </p>
                        )}
                      </div>

                      <span
                        className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${TYPE_STYLES[h.type]}`}
                      >
                        {TYPE_LABELS[h.type]}
                      </span>

                      {canManage && (
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Delete ${h.name}`}
                          onClick={() => setToDelete(h)}
                        >
                          <Trash2Icon className="text-muted-foreground" />
                        </Button>
                      )}
                    </div>
                  );
                })}
              </Card>
            </section>
          ))}
        </div>
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Holiday</DialogTitle>
            <DialogDescription>
              Employees see this on their calendar and dashboard.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <Label htmlFor="holiday-name" className="mb-1.5">
                Name
              </Label>
              <Input
                id="holiday-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Diwali"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="holiday-date" className="mb-1.5">
                  Date
                </Label>
                <Input
                  id="holiday-date"
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                />
              </div>

              <div>
                <Label htmlFor="holiday-type" className="mb-1.5">
                  Type
                </Label>
                <select
                  id="holiday-type"
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                  className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <option value="public">Public</option>
                  <option value="optional">Optional</option>
                  <option value="company">Company</option>
                </select>
              </div>
            </div>

            <div>
              <Label htmlFor="holiday-location" className="mb-1.5">
                Applies to
              </Label>
              <select
                id="holiday-location"
                value={form.locationId}
                onChange={(e) => setForm({ ...form, locationId: e.target.value })}
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <option value="">The whole company</option>
                {sites.map((site) => (
                  <option key={site.id} value={site.id}>Only {site.name}</option>
                ))}
              </select>
            </div>

            <div>
              <Label htmlFor="holiday-description" className="mb-1.5">
                Note (optional)
              </Label>
              <Input
                id="holiday-description"
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowForm(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Adding…" : "Add Holiday"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(open) => !open && setToDelete(null)}
        title="Delete holiday?"
        description={toDelete ? `${toDelete.name} will be removed from the calendar.` : undefined}
        confirmLabel="Delete"
        loading={deleting}
        onConfirm={handleDelete}
      />
    </div>
  );
}
