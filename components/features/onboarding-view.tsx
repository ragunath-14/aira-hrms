"use client";

import { useEffect, useMemo, useState } from "react";
import { ClipboardCheckIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import {
  ErrorBanner,
  Pill,
  apiError,
  labelize,
  selectClass,
} from "@/components/shared/ui-bits";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

type Task = {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  kind: "onboarding" | "offboarding";
  title: string;
  done: boolean;
};

type Employee = { id: string; firstName: string; lastName: string | null; employeeCode: string };

export function OnboardingView({ isHr }: { isHr: boolean }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [pick, setPick] = useState({ employeeId: "", kind: "onboarding" });
  const [custom, setCustom] = useState<Record<string, string>>({});

  async function load() {
    try {
      setError("");
      const res = await fetch("/api/onboarding");
      if (!res.ok) throw new Error(await apiError(res, "Failed to load checklists"));
      setTasks(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load checklists");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();

    if (isHr) {
      fetch("/api/employees")
        .then((r) => (r.ok ? r.json() : []))
        .then((list: Employee[]) => {
          setEmployees(list);
          setPick((p) => ({ ...p, employeeId: list[0]?.id ?? "" }));
        })
        .catch(() => {});
    }
  }, [isHr]);

  // One group per employee + checklist kind.
  const groups = useMemo(() => {
    const map = new Map<string, { key: string; employeeId: string; name: string; kind: Task["kind"]; items: Task[] }>();

    tasks.forEach((t) => {
      const key = `${t.employeeId}:${t.kind}`;
      if (!map.has(key)) {
        map.set(key, { key, employeeId: t.employeeId, name: t.employeeName, kind: t.kind, items: [] });
      }
      map.get(key)!.items.push(t);
    });

    return [...map.values()];
  }, [tasks]);

  async function call(url: string, method: string, body?: object, ok?: string) {
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      toast.error(await apiError(res, "Request failed"));
      return false;
    }

    if (ok) toast.success(ok);
    load();
    return true;
  }

  const toggle = (t: Task) => {
    // Update instantly, then confirm with the server.
    setTasks((cur) => cur.map((x) => (x.id === t.id ? { ...x, done: !t.done } : x)));
    call(`/api/onboarding/${t.id}`, "PATCH", { done: !t.done });
  };

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title={isHr ? "Onboarding & Offboarding" : "My Checklist"}
        description={
          isHr
            ? "Give joiners and leavers a checklist and track it to completion."
            : "Complete these steps for your joining or exit."
        }
      />

      <ErrorBanner message={error} />

      {isHr && (
        <Card className="mb-6 flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
          <select
            aria-label="Employee"
            className={`${selectClass} sm:max-w-xs`}
            value={pick.employeeId}
            onChange={(e) => setPick({ ...pick, employeeId: e.target.value })}
          >
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.firstName} {e.lastName ?? ""} ({e.employeeCode})
              </option>
            ))}
          </select>
          <select
            aria-label="Checklist type"
            className={`${selectClass} sm:max-w-40`}
            value={pick.kind}
            onChange={(e) => setPick({ ...pick, kind: e.target.value })}
          >
            <option value="onboarding">Onboarding</option>
            <option value="offboarding">Offboarding</option>
          </select>
          <Button
            disabled={!pick.employeeId}
            onClick={() => call("/api/onboarding", "POST", pick, "Checklist started")}
          >
            <PlusIcon /> Start checklist
          </Button>
        </Card>
      )}

      {loading ? (
        <Skeleton className="h-48 w-full rounded-xl" />
      ) : groups.length === 0 ? (
        <EmptyState
          icon={ClipboardCheckIcon}
          title="No checklists yet"
          description={isHr ? "Pick an employee above to start a checklist." : "HR will assign your checklist when it is ready."}
        />
      ) : (
        <div className="space-y-4">
          {groups.map((g) => {
            const done = g.items.filter((i) => i.done).length;
            const pct = Math.round((done / g.items.length) * 100);

            return (
              <Card key={g.key} className="p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{isHr ? g.name : labelize(g.kind)}</p>
                    {isHr && <p className="text-xs text-muted-foreground">{labelize(g.kind)}</p>}
                  </div>
                  <Pill tone={pct === 100 ? "green" : "blue"}>{done}/{g.items.length} done</Pill>
                </div>

                <div className="mb-4 h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
                  <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
                </div>

                <ul className="space-y-1">
                  {g.items.map((t) => (
                    <li key={t.id} className="flex items-center gap-3 rounded-md px-1 py-1.5 hover:bg-muted/50">
                      <input
                        id={`task-${t.id}`}
                        type="checkbox"
                        className="size-4 rounded border-input"
                        checked={t.done}
                        onChange={() => toggle(t)}
                      />
                      <label
                        htmlFor={`task-${t.id}`}
                        className={`flex-1 cursor-pointer text-sm ${t.done ? "text-muted-foreground line-through" : ""}`}
                      >
                        {t.title}
                      </label>
                      {isHr && (
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label={`Delete task ${t.title}`}
                          onClick={() => call(`/api/onboarding/${t.id}`, "DELETE")}
                        >
                          <Trash2Icon className="text-muted-foreground" />
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>

                {isHr && (
                  <form
                    className="mt-3 flex gap-2"
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const title = (custom[g.key] ?? "").trim();
                      if (!title) return;

                      if (await call("/api/onboarding", "POST", { employeeId: g.employeeId, kind: g.kind, title })) {
                        setCustom({ ...custom, [g.key]: "" });
                      }
                    }}
                  >
                    <Input
                      aria-label="Add a task"
                      placeholder="Add a task…"
                      value={custom[g.key] ?? ""}
                      onChange={(e) => setCustom({ ...custom, [g.key]: e.target.value })}
                    />
                    <Button type="submit" variant="outline">Add</Button>
                  </form>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
