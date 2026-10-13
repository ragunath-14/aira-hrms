"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  BanknoteIcon,
  BellIcon,
  CalendarCheckIcon,
  CalendarDaysIcon,
  ClipboardListIcon,
  FileTextIcon,
  LogInIcon,
  LogOutIcon,
  MegaphoneIcon,
  UserIcon,
  WalletCardsIcon,
} from "lucide-react";
import { toast } from "sonner";

import { InsightsPanel } from "@/components/features/insights-panel";
import { useEmployee } from "@/components/layout/employee-context";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate, getDisplayPrefs } from "@/lib/format/date";
import { cn } from "cn";

type TodayAttendance = {
  attendance: {
    id: string;
    attendanceDate: string;
    checkIn: string | null;
    checkOut: string | null;
    status: string;
  } | null;
  today: string;
};

type Stats = {
  monthCount: number;
  onTimePct: number | null;
  pendingLeaves: number;
  pendingLeaveLabel: string;
  balanceTotal: number;
  balanceChips: string[];
  payslipCount: number;
  latestPayslip: string | null;
  documentCount: number;
};

const EMPTY_STATS: Stats = {
  monthCount: 0,
  onTimePct: null,
  pendingLeaves: 0,
  pendingLeaveLabel: "",
  balanceTotal: 0,
  balanceChips: [],
  payslipCount: 0,
  latestPayslip: null,
  documentCount: 0,
};

function monthLabel(period: string) {
  const [y, m] = period.split("-").map(Number);
  if (!y || !m) return period;
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-IN", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export default function EmployeeDashboardPage() {
  const { employee, unreadCount } = useEmployee();

  const [todayAttendance, setTodayAttendance] = useState<TodayAttendance | null>(null);
  const [stats, setStats] = useState<Stats>(EMPTY_STATS);
  const [shiftStart, setShiftStart] = useState("09:30");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const loadAll = useCallback(async () => {
    try {
      const get = async (url: string) => {
        const res = await fetch(url);
        return res.ok ? res.json() : null;
      };

      const [today, attendance, leaves, balances, payslips, docs, display] = await Promise.all([
        get("/api/attendance/today"),
        get("/api/employee/attendance"),
        get("/api/employee/leave-requests"),
        get("/api/employee/leave-balances"),
        get("/api/employee/payslips"),
        get("/api/employee/documents"),
        get("/api/settings/display"),
      ]);

      if (today) setTodayAttendance(today);
      if (display?.shiftStart) setShiftStart(display.shiftStart);

      const next: Stats = { ...EMPTY_STATS };

      if (Array.isArray(attendance)) {
        const month = (today?.today ?? new Date().toISOString().slice(0, 10)).slice(0, 7);
        const mine = attendance.filter((a: { attendanceDate: string }) =>
          a.attendanceDate.startsWith(month),
        );
        next.monthCount = mine.length;
        if (mine.length > 0) {
          const onTime = mine.filter((a: { status: string }) => a.status === "present").length;
          next.onTimePct = Math.round((onTime / mine.length) * 1000) / 10;
        }
      }

      if (Array.isArray(leaves)) {
        const pending = leaves.filter((l: { status: string }) => l.status === "pending");
        next.pendingLeaves = pending.length;
        next.pendingLeaveLabel =
          pending.length === 1
            ? pending[0].leaveType ?? "Leave"
            : pending.length > 1
              ? `${pending.length} requests`
              : "";
      }

      if (Array.isArray(balances) && balances.length > 0) {
        const year = Math.max(...balances.map((b: { year: number }) => b.year));
        const current = balances.filter((b: { year: number }) => b.year === year);
        next.balanceTotal = current.reduce(
          (sum: number, b: { remainingDays: number }) => sum + b.remainingDays,
          0,
        );
        next.balanceChips = current
          .slice(0, 3)
          .map(
            (b: { leaveType: string | null; remainingDays: number }) =>
              `${(b.leaveType ?? "Leave").split(" ")[0]}: ${b.remainingDays}`,
          );
      }

      if (Array.isArray(payslips)) {
        next.payslipCount = payslips.length;
        const latest = [...payslips]
          .map((p: { payrollPeriod: string }) => p.payrollPeriod)
          .sort()
          .pop();
        next.latestPayslip = latest ?? null;
      }

      if (Array.isArray(docs)) next.documentCount = docs.length;

      setStats(next);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  async function punch(kind: "check-in" | "check-out") {
    setBusy(true);

    try {
      const res = await fetch(`/api/attendance/${kind}`, { method: "POST" });
      const data = await res.json();

      if (!res.ok) {
        toast.error(typeof data.error === "string" ? data.error : "Request failed");
      } else {
        toast.success(kind === "check-in" ? "Checked in" : "Checked out");
        await loadAll();
      }
    } catch {
      toast.error("Request failed. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  if (!employee) return null;

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-28 w-full rounded-2xl" />
        <Skeleton className="h-44 w-full rounded-2xl" />
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-36 w-full rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  const initials = `${employee.firstName[0] ?? ""}${employee.lastName?.[0] ?? ""}`.toUpperCase();
  const fullName = `${employee.firstName}${employee.lastName ? ` ${employee.lastName}` : ""}`;
  const record = todayAttendance?.attendance ?? null;
  const checkedIn = !!record?.checkIn;
  const checkedOut = !!record?.checkOut;

  return (
    <div className="space-y-6">
      {/* Profile */}
      <section className="flex flex-wrap items-center gap-5 rounded-2xl border bg-card p-6 shadow-sm">
        <div className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br from-primary to-indigo-500 text-2xl font-bold text-white shadow-md">
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="truncate text-2xl font-bold text-foreground">{fullName}</h1>
            <span className="rounded-full bg-primary px-3 py-0.5 text-xs font-semibold capitalize text-primary-foreground">
              {employee.status.replace(/_/g, " ")}
            </span>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            <span className="rounded-md bg-muted px-2 py-0.5 font-mono text-xs">{employee.employeeCode}</span>
            <a href={`mailto:${employee.email}`} className="text-primary hover:underline">
              {employee.email}
            </a>
            {(employee.designationName || employee.departmentName) && (
              <>
                <span aria-hidden>•</span>
                <span>
                  {[employee.designationName, employee.departmentName && `${employee.departmentName} Department`]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </>
            )}
          </div>
        </div>
        <Button variant="outline" size="lg" render={<Link href="/employee/profile" />}>
          <UserIcon /> View My Profile
        </Button>
      </section>

      {/* Today's attendance */}
      <AttendanceBanner
        record={record}
        today={todayAttendance?.today ?? ""}
        shiftStart={shiftStart}
        checkedIn={checkedIn}
        checkedOut={checkedOut}
        busy={busy}
        onPunch={punch}
      />

      {/* KPIs */}
      <section className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3" aria-label="Summary">
        <Kpi
          label="Attendance records"
          value={stats.monthCount}
          caption="Days logged this month"
          icon={CalendarCheckIcon}
          tone="blue"
          chip={stats.onTimePct !== null ? `${stats.onTimePct}% on-time` : "No records yet"}
          chipTone={stats.onTimePct !== null ? "green" : "gray"}
        />
        <Kpi
          label="Pending leaves"
          value={stats.pendingLeaves}
          caption="Awaiting approval"
          icon={FileTextIcon}
          tone="orange"
          chip={stats.pendingLeaveLabel || "Nothing pending"}
          chipTone={stats.pendingLeaves > 0 ? "orange" : "gray"}
        />
        <Kpi
          label="Leave balances"
          value={stats.balanceTotal}
          caption="Total remaining days"
          icon={ClipboardListIcon}
          tone="indigo"
          chip={stats.balanceChips.join(" | ") || "No balances"}
          chipTone="gray"
        />
        <Kpi
          label="Payslips"
          value={stats.payslipCount}
          caption="Salary statements"
          icon={WalletCardsIcon}
          tone="green"
          chip={stats.latestPayslip ? `${monthLabel(stats.latestPayslip)} ready` : "None yet"}
          chipTone={stats.latestPayslip ? "gray" : "gray"}
        />
        <Kpi
          label="Documents"
          value={stats.documentCount}
          caption="Files on record"
          icon={FileTextIcon}
          tone="cyan"
          chip={stats.documentCount > 0 ? "On file" : "None yet"}
          chipTone={stats.documentCount > 0 ? "green" : "gray"}
        />
        <Kpi
          label="Unread notifications"
          value={unreadCount}
          caption="Alerts require review"
          icon={BellIcon}
          tone="purple"
          chip={unreadCount > 0 ? "Action needed" : "All caught up"}
          chipTone={unreadCount > 0 ? "purple" : "gray"}
        />
      </section>

      {/* Quick actions */}
      <section>
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-lg font-bold text-foreground">Quick actions</h2>
          <p className="text-sm text-muted-foreground">Frequently used tools</p>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          <QuickAction href="/employee/leave" icon={ClipboardListIcon} label="Request leave" />
          <QuickAction href="/employee/attendance" icon={CalendarCheckIcon} label="Attendance" />
          <QuickAction href="/employee/payslips" icon={BanknoteIcon} label="Payslips" />
          <QuickAction href="/employee/holidays" icon={CalendarDaysIcon} label="Holidays" />
          <QuickAction href="/employee/announcements" icon={MegaphoneIcon} label="Announcements" />
          <QuickAction href="/employee/documents" icon={FileTextIcon} label="Documents" />
        </div>
      </section>

      <InsightsPanel basePath="/employee" variant="workspace" currentEmployeeId={employee.id} />
    </div>
  );
}

/* ------------------------------------------------------------------ */

function useClock(timeZone: string) {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, [timeZone]);

  return now;
}

function AttendanceBanner({
  record,
  today,
  shiftStart,
  checkedIn,
  checkedOut,
  busy,
  onPunch,
}: {
  record: TodayAttendance["attendance"];
  today: string;
  shiftStart: string;
  checkedIn: boolean;
  checkedOut: boolean;
  busy: boolean;
  onPunch: (kind: "check-in" | "check-out") => void;
}) {
  const { timezone } = getDisplayPrefs();
  const now = useClock(timezone);

  const clock = now
    ? new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      }).format(now)
    : "--:--:--";

  const weekday = now
    ? new Intl.DateTimeFormat("en-US", { timeZone: timezone, weekday: "long" }).format(now)
    : "";

  const time = (iso: string) =>
    new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }).format(new Date(iso));

  const [h, m] = shiftStart.split(":").map(Number);
  const shiftLabel = new Date(Date.UTC(2000, 0, 1, h, m)).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "UTC",
  });

  const state = checkedOut
    ? { label: "Completed", cls: "border-sky-400/40 bg-sky-400/15 text-sky-200" }
    : checkedIn
      ? { label: "Checked In", cls: "border-emerald-400/40 bg-emerald-400/15 text-emerald-200" }
      : { label: "Not Checked In", cls: "border-amber-400/50 bg-amber-400/15 text-amber-200" };

  return (
    <section
      aria-label="Today's attendance"
      className="relative overflow-hidden rounded-2xl bg-linear-to-br from-slate-950 via-slate-900 to-indigo-950 p-6 text-white shadow-lg sm:p-8"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-primary/25 blur-3xl"
      />

      <div className="relative flex flex-wrap items-center justify-between gap-6">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-md border border-primary/40 bg-primary/20 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-sky-200">
              Today&apos;s attendance
            </span>
            <span className="text-sm text-slate-300">
              {weekday}
              {today ? `, ${formatDate(today)}` : ""}
            </span>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <p className="font-mono text-4xl font-bold tabular-nums tracking-tight sm:text-5xl" aria-live="off">
              {clock}
            </p>
            <span className={cn("rounded-md border px-2.5 py-1 text-xs font-semibold", state.cls)}>
              {state.label}
            </span>
          </div>

          <p className="mt-4 text-sm text-slate-300">
            {record?.checkIn ? (
              <>
                Checked in at <strong className="text-white">{time(record.checkIn)}</strong>
                {record.checkOut && (
                  <>
                    {" "}and out at <strong className="text-white">{time(record.checkOut)}</strong>
                  </>
                )}
                . Shift starts at <strong className="text-white">{shiftLabel}</strong>.
              </>
            ) : (
              <>
                No attendance record registered for today yet. Shift starts at{" "}
                <strong className="text-white">{shiftLabel}</strong>.
              </>
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {!checkedIn && (
            <Button
              size="lg"
              disabled={busy}
              onClick={() => onPunch("check-in")}
              className="h-12 gap-2 rounded-xl px-6 text-base shadow-lg shadow-primary/30"
            >
              <LogInIcon className="size-5" />
              {busy ? "Processing…" : "Check In"}
            </Button>
          )}
          {checkedIn && !checkedOut && (
            <Button
              size="lg"
              disabled={busy}
              onClick={() => onPunch("check-out")}
              className="h-12 gap-2 rounded-xl px-6 text-base shadow-lg shadow-primary/30"
            >
              <LogOutIcon className="size-5" />
              {busy ? "Processing…" : "Check Out"}
            </Button>
          )}
          <Link
            href="/employee/tickets"
            className="inline-flex h-12 items-center rounded-xl border border-white/15 bg-white/10 px-5 text-sm font-semibold text-white transition hover:bg-white/15"
          >
            Regularize Request
          </Link>
        </div>
      </div>
    </section>
  );
}

const TONES = {
  blue: "bg-blue-50 text-blue-600",
  orange: "bg-orange-50 text-orange-600",
  indigo: "bg-indigo-50 text-indigo-600",
  green: "bg-emerald-50 text-emerald-600",
  cyan: "bg-cyan-50 text-cyan-600",
  purple: "bg-purple-50 text-purple-600",
} as const;

const CHIPS = {
  green: "bg-emerald-50 text-emerald-700",
  orange: "bg-orange-50 text-orange-700",
  purple: "bg-purple-50 text-purple-700",
  gray: "bg-muted text-muted-foreground",
} as const;

function Kpi({
  label,
  value,
  caption,
  icon: Icon,
  tone,
  chip,
  chipTone,
}: {
  label: string;
  value: number;
  caption: string;
  icon: typeof BellIcon;
  tone: keyof typeof TONES;
  chip: ReactNode;
  chipTone: keyof typeof CHIPS;
}) {
  return (
    <div className="rounded-2xl border bg-card p-6 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
        <span className={cn("flex size-11 shrink-0 items-center justify-center rounded-xl", TONES[tone])}>
          <Icon className="size-6" />
        </span>
      </div>
      <div className="mt-3 flex items-end justify-between gap-3">
        <p className="text-4xl font-bold tabular-nums text-foreground">{value}</p>
        <span className={cn("max-w-[60%] truncate rounded-md px-2.5 py-1 text-xs font-medium", CHIPS[chipTone])}>
          {chip}
        </span>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">{caption}</p>
    </div>
  );
}

function QuickAction({
  href,
  icon: Icon,
  label,
}: {
  href: string;
  icon: typeof BellIcon;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col items-center gap-3 rounded-2xl border bg-card px-3 py-6 text-center shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
    >
      <span className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary transition group-hover:bg-primary group-hover:text-primary-foreground">
        <Icon className="size-6" />
      </span>
      <span className="text-sm font-semibold text-foreground">{label}</span>
    </Link>
  );
}
