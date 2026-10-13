"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  BriefcaseIcon,
  Building2Icon,
  CalendarPlusIcon,
  PhoneCallIcon,
  VideoIcon,
  CoffeeIcon,
  HourglassIcon,
  LaptopIcon,
  LogInIcon,
  LogOutIcon,
  SearchIcon,
  UtensilsIcon,
} from "lucide-react";
import { toast } from "sonner";

import { MeetingsPanel } from "@/components/features/meetings-panel";
import { ScheduleMeetingDialog } from "@/components/features/schedule-meeting-dialog";
import { Button } from "@/components/ui/button";
import { clampPage, paginate } from "@/components/shared/data-table-pagination";
import { Skeleton } from "@/components/ui/skeleton";
import { getDisplayPrefs } from "@/lib/format/date";
import { cn } from "cn";

type State = "in" | "out" | "away" | "leave";

type Member = {
  id: string;
  name: string;
  email: string;
  designation: string | null;
  state: State;
  checkIn: string | null;
  checkOut: string | null;
  workMode: string | null;
  onBreak: { type: string; until: string } | null;
  isYou: boolean;
};

type Payload = {
  today: string;
  timezone: string;
  department: { id: string; name: string };
  departments: { id: string; name: string }[];
  members: Member[];
};

const DOT: Record<State, string> = {
  in: "bg-emerald-500",
  out: "bg-slate-400",
  away: "bg-amber-400",
  leave: "bg-sky-500",
};

function initialsOf(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

// People shown per column before paging.
const PAGE_SIZE = 6;

const BREAK_LABEL: Record<string, string> = { lunch: "lunch", break: "a break", away: "away" };

// Where the quick links go: the employee workspace or the HR console.
const LINKS = {
  employee: { leave: "/employee/leave", holidays: "/employee/holidays", planner: "/employee/leave/planner" },
  hr: { leave: "/leave", holidays: "/holidays", planner: "/leave" },
} as const;

export function WorkplaceView({ portal = "employee" }: { portal?: "employee" | "hr" }) {
  const links = LINKS[portal];
  const [pendingMode, setPendingMode] = useState<"office" | "remote">("office");
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [meetingsKey, setMeetingsKey] = useState(0);
  const [starting, setStarting] = useState(false);
  const [minutes, setMinutes] = useState({ lunch: 60, break: 15, away: 15 });
  const [data, setData] = useState<Payload | null>(null);
  const [department, setDepartment] = useState<string>("");
  const [query, setQuery] = useState("");
  const [pages, setPages] = useState({ in: 1, away: 1, leave: 1 });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(async (dept: string) => {
    try {
      const res = await fetch(`/api/employee/workplace${dept ? `?department=${dept}` : ""}`);
      const body = await res.json();

      if (!res.ok) throw new Error(typeof body.error === "string" ? body.error : "Failed to load");

      setData(body);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load the workplace");
    }
  }, []);

  useEffect(() => {
    load(department);
    const refresh = setInterval(() => load(department), 30_000);
    const tick = setInterval(() => setNow(Date.now()), 30_000);

    return () => {
      clearInterval(refresh);
      clearInterval(tick);
    };
  }, [department, load]);

  const { timezone } = getDisplayPrefs();
  const clockTime = (iso: string) =>
    new Intl.DateTimeFormat("en-US", {
      timeZone: data?.timezone ?? timezone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }).format(new Date(iso));

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = data?.members ?? [];
    return q
      ? list.filter((m) => `${m.name} ${m.email} ${m.designation ?? ""}`.toLowerCase().includes(q))
      : list;
  }, [data, query]);

  const atWork = visible.filter((m) => m.state === "in");
  const away = visible.filter((m) => m.state === "out" || m.state === "away");
  const onLeave = visible.filter((m) => m.state === "leave");

  const shownAtWork = paginate(atWork, pages.in, PAGE_SIZE);
  const shownAway = paginate(away, pages.away, PAGE_SIZE);
  const shownOnLeave = paginate(onLeave, pages.leave, PAGE_SIZE);

  const me = data?.members.find((m) => m.isYou);

  async function punch(kind: "check-in" | "check-out") {
    setBusy(true);

    try {
      const res = await fetch(`/api/attendance/${kind}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(kind === "check-in" ? { workMode: pendingMode } : {}),
      });
      const body = await res.json();

      if (!res.ok) {
        toast.error(typeof body.error === "string" ? body.error : "Request failed");
      } else {
        toast.success(kind === "check-in" ? "Checked in" : "Checked out");
        await load(department);
      }
    } catch {
      toast.error("Request failed. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  // "Meet Now" (no one) or "Call" (one colleague). The tab is opened straight
  // away from the click so the browser does not block it as a pop-up.
  async function startMeeting(attendeeIds: string[] = []) {
    const tab = window.open("", "_blank");
    setStarting(true);

    try {
      const res = await fetch("/api/meetings/instant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attendeeIds }),
      });
      const body = await res.json();

      if (!res.ok) throw new Error(typeof body.error === "string" ? body.error : "Could not start the meeting");

      if (tab) tab.location.href = body.joinUrl;
      else window.location.href = body.joinUrl;

      toast.success(attendeeIds.length === 1 ? "Calling… they have been notified." : "Meeting started.");
      setMeetingsKey((k) => k + 1);
    } catch (err) {
      tab?.close();
      toast.error(err instanceof Error ? err.message : "Could not start the meeting");
    } finally {
      setStarting(false);
    }
  }

  async function setPresence(change: {
    workMode?: "office" | "remote";
    status?: "working" | "lunch" | "break" | "away";
    minutes?: number;
  }) {
    setBusy(true);

    try {
      const res = await fetch("/api/attendance/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(change),
      });
      const body = await res.json();

      if (!res.ok) {
        toast.error(typeof body.error === "string" ? body.error : "Could not update your status");
      } else {
        await load(department);
      }
    } catch {
      toast.error("Could not update your status. Check your connection.");
    } finally {
      setBusy(false);
    }
  }

  function statusLine(m: Member) {
    if (m.onBreak) return `On ${BREAK_LABEL[m.onBreak.type] ?? "a break"} until ${clockTime(m.onBreak.until)}`;
    if (m.state === "in" && m.checkIn) return `In since ${clockTime(m.checkIn)}`;
    if (m.state === "out" && m.checkOut) return `Out at ${clockTime(m.checkOut)}`;
    if (m.state === "leave") return "On leave today";
    return "Not checked in";
  }

  function worked(m: Member | undefined) {
    if (!m?.checkIn) return "";
    const end = m.checkOut ? new Date(m.checkOut).getTime() : now;
    const mins = Math.max(0, Math.round((end - new Date(m.checkIn).getTime()) / 60_000));
    return `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, "0")}m`;
  }

  if (error && !data) {
    return (
      <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
        {error}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-16 w-full rounded-2xl" />
        <Skeleton className="h-12 w-full rounded-2xl" />
        <div className="grid gap-6 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-96 w-full rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  const total = data.members.length;
  const selected = department || data.department.id;

  return (
    <div className="space-y-6">
      {/* Status bar */}
      <section
        aria-label="Your status"
        className="flex flex-wrap items-center gap-x-5 gap-y-3 rounded-2xl border bg-card px-5 py-3.5 shadow-sm"
      >
        <span className="text-sm font-semibold text-foreground">Status</span>

        {me?.state === "in" ? (
          <>
            <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Set your status">
              <StatusChip
                active={!me.onBreak}
                disabled={busy}
                onClick={() => setPresence({ status: "working" })}
                icon={<BriefcaseIcon className="size-4" />}
                label="Working"
              />
              {(["lunch", "break", "away"] as const).map((kind) => (
                <span key={kind} className="inline-flex items-center">
                  <StatusChip
                    active={me.onBreak?.type === kind}
                    disabled={busy}
                    onClick={() => setPresence({ status: kind, minutes: minutes[kind] })}
                    icon={
                      kind === "lunch" ? (
                        <UtensilsIcon className="size-4" />
                      ) : kind === "break" ? (
                        <CoffeeIcon className="size-4" />
                      ) : (
                        <HourglassIcon className="size-4" />
                      )
                    }
                    label={kind === "lunch" ? "Lunch" : kind === "break" ? "Break" : "Away"}
                    attached
                  />
                  <select
                    aria-label={`${kind} duration`}
                    className="h-9 rounded-r-lg border border-l-0 bg-muted/50 pl-1 pr-1 text-xs outline-none"
                    value={minutes[kind]}
                    onChange={(e) => setMinutes({ ...minutes, [kind]: Number(e.target.value) })}
                  >
                    {[10, 15, 30, 45, 60, 90].map((n) => (
                      <option key={n} value={n}>
                        {n} min
                      </option>
                    ))}
                  </select>
                </span>
              ))}
            </div>

            <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                role="switch"
                className="peer sr-only"
                checked={me.workMode === "remote"}
                disabled={busy}
                onChange={(e) => setPresence({ workMode: e.target.checked ? "remote" : "office" })}
              />
              <span className="relative h-6 w-11 rounded-full bg-muted transition peer-checked:bg-primary after:absolute after:left-0.5 after:top-0.5 after:size-5 after:rounded-full after:bg-background after:shadow after:transition-all after:content-[''] peer-checked:after:translate-x-5 peer-focus-visible:ring-2 peer-focus-visible:ring-ring" />
              <LaptopIcon className="size-4 text-muted-foreground" />
              Remote work
            </label>

            <span className="text-sm text-muted-foreground">
              Working for <strong className="text-foreground">{worked(me)}</strong>
            </span>
          </>
        ) : (
          <>
            <span
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-medium",
                me?.state === "out" && "border-slate-200 bg-slate-50 text-slate-600",
                me?.state === "leave" && "border-sky-200 bg-sky-50 text-sky-700",
                (!me || me.state === "away") && "border-amber-200 bg-amber-50 text-amber-700",
              )}
            >
              <span className={cn("size-2 rounded-full", DOT[me?.state ?? "away"])} />
              {me ? statusLine(me) : "Not checked in"}
            </span>

            {me?.checkOut ? (
              <span className="text-sm text-muted-foreground">
                Worked <strong className="text-foreground">{worked(me)}</strong>
              </span>
            ) : (
              me?.state !== "leave" && (
                <div className="inline-flex rounded-lg border p-0.5" role="group" aria-label="Where are you working today?">
                  {(["office", "remote"] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      aria-pressed={pendingMode === mode}
                      onClick={() => setPendingMode(mode)}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition",
                        pendingMode === mode ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {mode === "office" ? <Building2Icon className="size-4" /> : <LaptopIcon className="size-4" />}
                      {mode === "office" ? "Office" : "Remote"}
                    </button>
                  ))}
                </div>
              )
            )}
          </>
        )}

        <div className="ml-auto flex items-center gap-3">
          {me?.state !== "in" && !me?.checkOut && me?.state !== "leave" && (
            <Button disabled={busy} onClick={() => punch("check-in")}>
              <LogInIcon /> {busy ? "Processing…" : "Check In"}
            </Button>
          )}
          {me?.state === "in" && (
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => punch("check-out")}
              className="border-destructive/40 text-destructive hover:bg-destructive/10"
            >
              <LogOutIcon /> {busy ? "Processing…" : "Check Out"}
            </Button>
          )}
        </div>
      </section>

      {/* Department + actions */}
      <section className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <select
            aria-label="Department"
            className="max-w-xs rounded-lg border-0 bg-transparent py-1 pr-8 text-2xl font-bold text-primary outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={selected}
            onChange={(e) => {
              setData(null);
              setPages({ in: 1, away: 1, leave: 1 });
              setDepartment(e.target.value);
            }}
          >
            <option value="all">Whole company</option>
            {data.departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
          <span className="text-lg font-semibold text-muted-foreground">({total})</span>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button size="lg" className="h-11 gap-2 px-5 text-base" disabled={starting} onClick={() => startMeeting()}>
            <PhoneCallIcon className="size-5" /> {starting ? "Starting…" : "Meet Now"}
          </Button>
          <Button size="lg" variant="outline" className="h-11 gap-2 px-5 text-base" onClick={() => setScheduleOpen(true)}>
            <CalendarPlusIcon className="size-5" /> Schedule Meeting
          </Button>
        </div>
      </section>

      {/* Search */}
      <div className="relative">
        <SearchIcon className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          aria-label="Search department members"
          placeholder="Search for department members"
          className="h-12 w-full rounded-xl border bg-card pl-12 pr-4 text-base shadow-sm outline-none transition placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPages({ in: 1, away: 1, leave: 1 });
          }}
        />
      </div>

      {/* Columns */}
      <div className="grid items-start gap-6 lg:grid-cols-3">
        <Column title="At Work" count={atWork.length} tag="In" tagClass="text-emerald-600" page={pages.in} onPage={(n) => setPages({ ...pages, in: n })}>
          {atWork.length === 0 ? (
            <Empty text={query ? "No matches." : "Nobody has checked in yet."} />
          ) : (
            shownAtWork.map((m) => <Person key={m.id} m={m} line={statusLine(m)} onCall={() => startMeeting([m.id])} />)
          )}
        </Column>

        <Column title="Away" count={away.length} tag="Out" tagClass="text-muted-foreground" page={pages.away} onPage={(n) => setPages({ ...pages, away: n })}>
          {away.length === 0 ? (
            <Empty text={query ? "No matches." : "Everyone is at work."} />
          ) : (
            shownAway.map((m) => <Person key={m.id} m={m} line={statusLine(m)} onCall={() => startMeeting([m.id])} />)
          )}
        </Column>

        <Column
          title="On Leave"
          count={onLeave.length}
          tag="Today"
          tagClass="text-sky-600"
          page={pages.leave}
          onPage={(n) => setPages({ ...pages, leave: n })}
          footer={
            <Link href={links.planner} className="font-semibold underline decoration-dashed underline-offset-4">
              {portal === "hr" ? "View leave requests" : "View leave planner"}
            </Link>
          }
        >
          {onLeave.length === 0 ? (
            <Empty text={query ? "No matches." : "Nobody is on leave today."} />
          ) : (
            shownOnLeave.map((m) => <Person key={m.id} m={m} line={statusLine(m)} onCall={() => startMeeting([m.id])} />)
          )}
        </Column>
      </div>

      <MeetingsPanel refreshKey={meetingsKey} />

      <ScheduleMeetingDialog
        open={scheduleOpen}
        onOpenChange={setScheduleOpen}
        onScheduled={() => setMeetingsKey((k) => k + 1)}
      />
    </div>
  );
}

function Column({
  title,
  count,
  tag,
  tagClass,
  footer,
  page,
  onPage,
  children,
}: {
  title: string;
  count: number;
  tag: string;
  tagClass: string;
  footer?: React.ReactNode;
  page: number;
  onPage: (page: number) => void;
  children: React.ReactNode;
}) {
  const current = clampPage(page, count, PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));
  const from = count === 0 ? 0 : (current - 1) * PAGE_SIZE + 1;
  const to = Math.min(current * PAGE_SIZE, count);
  return (
    <section className="flex min-h-96 flex-col">
      <h2 className="mb-3 px-1 text-xl font-bold text-foreground">
        {title} <span className="text-base font-medium text-muted-foreground">({count})</span>
      </h2>
      <div className="flex flex-1 flex-col overflow-hidden rounded-2xl border bg-card shadow-sm">
        <div className="border-b bg-muted/60 px-5 py-3 text-sm font-semibold">
          <span className={tagClass}>{tag}</span>
          <span className="text-muted-foreground"> • {count}</span>
        </div>
        <ul className="flex-1 divide-y">{children}</ul>
        {count > PAGE_SIZE && (
          <nav
            aria-label={`${title} pages`}
            className="flex items-center justify-between border-t px-5 py-2.5 text-sm text-muted-foreground"
          >
            <span>
              {from}-{to} of {count}
            </span>
            <span className="flex items-center gap-2">
              <Button size="sm" variant="outline" disabled={current <= 1} onClick={() => onPage(current - 1)}>
                Previous
              </Button>
              <span className="tabular-nums">
                {current} / {totalPages}
              </span>
              <Button size="sm" variant="outline" disabled={current >= totalPages} onClick={() => onPage(current + 1)}>
                Next
              </Button>
            </span>
          </nav>
        )}
        {footer && (
          <div className="border-t bg-muted/60 px-5 py-3 text-center text-sm">{footer}</div>
        )}
      </div>
    </section>
  );
}

function Empty({ text }: { text: string }) {
  return <li className="flex h-48 items-center justify-center px-6 text-center text-sm text-muted-foreground">{text}</li>;
}

function Person({ m, line, onCall }: { m: Member; line: string; onCall: () => void }) {
  return (
    <li className="flex items-center gap-4 px-5 py-4">
      <span className="relative shrink-0">
        <span className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
          {initialsOf(m.name)}
        </span>
        <span
          className={cn(
            "absolute -bottom-0.5 -right-0.5 size-3.5 rounded-full ring-2 ring-card",
            m.onBreak ? "bg-amber-400" : DOT[m.state],
          )}
        />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-base font-semibold text-foreground">
          {m.isYou ? "You" : m.name}
          {m.isYou && <span className="ml-2 text-sm font-normal text-muted-foreground">{m.name}</span>}
        </p>
        <a href={`mailto:${m.email}`} className="block truncate text-sm text-muted-foreground hover:text-primary hover:underline">
          {m.email}
        </a>
        <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
          {m.state === "in" && m.workMode === "remote" && (
            <span className="inline-flex items-center gap-1 rounded bg-indigo-50 px-1.5 py-0.5 font-medium text-indigo-700">
              <LaptopIcon className="size-3" /> Remote
            </span>
          )}
          {m.state === "in" && m.workMode === "office" && (
            <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 font-medium text-slate-600">
              <Building2Icon className="size-3" /> Office
            </span>
          )}
          <span className="truncate">{[m.designation, line].filter(Boolean).join(" · ")}</span>
        </p>
      </div>
      {!m.isYou && m.state !== "leave" && (
        <button
          type="button"
          onClick={onCall}
          aria-label={`Call ${m.name}`}
          title={`Call ${m.name}`}
          className="flex size-10 shrink-0 items-center justify-center rounded-full border text-emerald-600 transition hover:bg-emerald-50"
        >
          <VideoIcon className="size-4.5" />
        </button>
      )}
    </li>
  );
}

function StatusChip({
  active,
  disabled,
  onClick,
  icon,
  label,
  attached,
}: {
  active: boolean;
  disabled: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  attached?: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex h-9 items-center gap-2 border px-3 text-sm font-medium transition disabled:opacity-60",
        attached ? "rounded-l-lg" : "rounded-lg",
        active
          ? "border-primary bg-primary/10 text-primary ring-1 ring-primary"
          : "bg-card text-foreground hover:bg-muted",
      )}
    >
      {icon}
      {label}
    </button>
  );
}
