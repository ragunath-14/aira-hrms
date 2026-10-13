"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeftIcon, ChevronRightIcon, ClockIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorBanner, apiError, selectClass } from "@/components/shared/ui-bits";
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

type Shift = { id: string; name: string; startTime: string; endTime: string };
type Assignment = { id: string; employeeId: string; shiftId: string; date: string };
type Employee = { id: string; firstName: string; lastName: string | null; employeeCode: string };

const DAY = 86_400_000;

function ymd(ms: number) {
  return new Date(ms).toISOString().slice(0, 10);
}

// Monday of the week containing `ms`, in UTC.
function weekStart(ms: number) {
  const d = new Date(ms);
  const dow = (d.getUTCDay() + 6) % 7;
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - dow * DAY;
}

export function ShiftsView({ isHr }: { isHr: boolean }) {
  const [start, setStart] = useState(() => weekStart(Date.now()));
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [newShift, setNewShift] = useState({ name: "", startTime: "09:00", endTime: "18:00" });

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => start + i * DAY), [start]);
  const [today] = useState(() => ymd(Date.now()));

  const load = useCallback(async () => {
    try {
      setError("");
      const [s, a] = await Promise.all([
        fetch("/api/shifts"),
        fetch(`/api/shift-assignments?from=${ymd(start)}&to=${ymd(start + 6 * DAY)}`),
      ]);

      if (!s.ok) throw new Error(await apiError(s, "Failed to load shifts"));
      if (!a.ok) throw new Error(await apiError(a, "Failed to load roster"));

      setShifts(await s.json());
      setAssignments(await a.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load roster");
    } finally {
      setLoading(false);
    }
  }, [start]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!isHr) return;

    fetch("/api/employees")
      .then((r) => (r.ok ? r.json() : []))
      .then(setEmployees)
      .catch(() => {});
  }, [isHr]);

  const shiftById = (id: string) => shifts.find((s) => s.id === id);
  const cell = (employeeId: string, date: string) =>
    assignments.find((a) => a.employeeId === employeeId && a.date === date);

  async function assign(employeeId: string, date: string, shiftId: string) {
    const res = await fetch("/api/shift-assignments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ employeeId, date, shiftId: shiftId || null }),
    });

    if (!res.ok) {
      toast.error(await apiError(res, "Failed to update roster"));
      return;
    }

    load();
  }

  async function createShift(e: React.FormEvent) {
    e.preventDefault();

    const res = await fetch("/api/shifts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newShift),
    });

    if (!res.ok) {
      toast.error(await apiError(res, "Failed to create shift"));
      return;
    }

    toast.success("Shift created");
    setNewShift({ ...newShift, name: "" });
    load();
  }

  async function deleteShift(id: string) {
    const res = await fetch(`/api/shifts/${id}`, { method: "DELETE" });

    if (!res.ok) {
      toast.error(await apiError(res, "Failed to delete shift"));
      return;
    }

    load();
  }

  const label = (ms: number) =>
    new Date(ms).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title={isHr ? "Shift Roster" : "My Shifts"}
        description={isHr ? "Define shifts and plan who works when." : "Your upcoming shifts this week."}
      />

      <ErrorBanner message={error} />

      <div className="mb-4 flex items-center gap-2">
        <Button variant="outline" size="icon" aria-label="Previous week" onClick={() => setStart(start - 7 * DAY)}>
          <ChevronLeftIcon />
        </Button>
        <span className="min-w-40 text-center text-sm font-medium">
          {label(start)} – {label(start + 6 * DAY)}
        </span>
        <Button variant="outline" size="icon" aria-label="Next week" onClick={() => setStart(start + 7 * DAY)}>
          <ChevronRightIcon />
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setStart(weekStart(Date.now()))}>
          This week
        </Button>
      </div>

      {isHr && (
        <Card className="mb-6 p-4">
          <p className="mb-3 text-sm font-semibold">Shifts</p>

          <div className="mb-3 flex flex-wrap gap-2">
            {shifts.length === 0 && (
              <p className="text-sm text-muted-foreground">Create your first shift below.</p>
            )}
            {shifts.map((s) => (
              <span key={s.id} className="inline-flex items-center gap-2 rounded-full border bg-muted/50 py-1 pl-3 pr-1 text-sm">
                <span className="font-medium">{s.name}</span>
                <span className="text-muted-foreground">{s.startTime}–{s.endTime}</span>
                <button
                  type="button"
                  aria-label={`Delete ${s.name}`}
                  className="flex size-6 items-center justify-center rounded-full text-muted-foreground hover:bg-background hover:text-destructive"
                  onClick={() => deleteShift(s.id)}
                >
                  <Trash2Icon className="size-3.5" />
                </button>
              </span>
            ))}
          </div>

          <form onSubmit={createShift} className="flex flex-wrap items-end gap-2">
            <div>
              <Label htmlFor="shift-name" className="mb-1 text-xs">Name</Label>
              <Input id="shift-name" required className="w-40" placeholder="e.g. Morning" value={newShift.name} onChange={(e) => setNewShift({ ...newShift, name: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="shift-start" className="mb-1 text-xs">Start</Label>
              <Input id="shift-start" type="time" required value={newShift.startTime} onChange={(e) => setNewShift({ ...newShift, startTime: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="shift-end" className="mb-1 text-xs">End</Label>
              <Input id="shift-end" type="time" required value={newShift.endTime} onChange={(e) => setNewShift({ ...newShift, endTime: e.target.value })} />
            </div>
            <Button type="submit"><PlusIcon /> Add shift</Button>
          </form>
        </Card>
      )}

      {loading ? (
        <Skeleton className="h-64 w-full rounded-xl" />
      ) : isHr ? (
        employees.length === 0 ? (
          <EmptyState icon={ClockIcon} title="No employees to schedule" />
        ) : (
          <Card className="overflow-x-auto p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-40">Employee</TableHead>
                  {days.map((d) => (
                    <TableHead key={d} className={`min-w-32 ${ymd(d) === today ? "text-primary" : ""}`}>
                      {new Date(d).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", timeZone: "UTC" })}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {employees.map((emp) => (
                  <TableRow key={emp.id}>
                    <TableCell>
                      <p className="font-medium">{emp.firstName} {emp.lastName ?? ""}</p>
                      <p className="text-xs text-muted-foreground">{emp.employeeCode}</p>
                    </TableCell>
                    {days.map((d) => {
                      const date = ymd(d);

                      return (
                        <TableCell key={date}>
                          <select
                            aria-label={`${emp.firstName} on ${date}`}
                            className={`${selectClass} h-7 text-xs`}
                            value={cell(emp.id, date)?.shiftId ?? ""}
                            onChange={(e) => assign(emp.id, date, e.target.value)}
                          >
                            <option value="">Off</option>
                            {shifts.map((s) => (
                              <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                          </select>
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {days.map((d) => {
            const date = ymd(d);
            const shift = shiftById(assignments.find((a) => a.date === date)?.shiftId ?? "");

            return (
              <Card key={date} className={`p-4 ${date === today ? "border-primary ring-1 ring-primary" : ""}`}>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {new Date(d).toLocaleDateString("en-IN", { weekday: "long", timeZone: "UTC" })} · {label(d)}
                </p>
                {shift ? (
                  <>
                    <p className="mt-2 font-semibold">{shift.name}</p>
                    <p className="text-sm text-muted-foreground">{shift.startTime} – {shift.endTime}</p>
                  </>
                ) : (
                  <p className="mt-2 text-sm text-muted-foreground">No shift</p>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
