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
} from "lucide-react";

import { InsightsPanel } from "@/components/features/insights-panel";
import { useEmployee } from "@/components/layout/employee-context";
import { PhotoEditor } from "@/components/shared/employee-photo";
import { usePunch } from "@/components/features/use-punch";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getDisplayPrefs } from "@/lib/format/date";
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
};

const EMPTY_STATS: Stats = {
  monthCount: 0,
  onTimePct: null,
  pendingLeaves: 0,
  pendingLeaveLabel: "",
};

export default function EmployeeDashboardPage() {
  const { employee, reload } = useEmployee();

  const [todayAttendance, setTodayAttendance] = useState<TodayAttendance | null>(null);
  const [stats, setStats] = useState<Stats>(EMPTY_STATS);
  const [shiftStart, setShiftStart] = useState("09:30");
  const [loading, setLoading] = useState(true);

  const loadAll = useCallback(async () => {
    try {
      const get = async (url: string) => {
        const res = await fetch(url);
        return res.ok ? res.json() : null;
      };

      const [today, attendance, leaves, display] = await Promise.all([
        get("/api/attendance/today"),
        get("/api/employee/attendance"),
        get("/api/employee/leave-requests"),
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

      setStats(next);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const { punch, busy, dialog: punchDialog } = usePunch(loadAll);

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

  const fullName = `${employee.firstName}${employee.lastName ? ` ${employee.lastName}` : ""}`;
  const record = todayAttendance?.attendance ?? null;
  const checkedIn = !!record?.checkIn;
  const checkedOut = !!record?.checkOut;

  const { timezone } = getDisplayPrefs();
  const timeOf = (iso: string) =>
    new Intl.DateTimeFormat("en-US", { timeZone: timezone, hour: "2-digit", minute: "2-digit", hour12: true }).format(
      new Date(iso),
    );
  const [shiftHour, shiftMinute] = shiftStart.split(":").map(Number);
  const shiftLabel = new Date(Date.UTC(2000, 0, 1, shiftHour, shiftMinute)).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "UTC",
  });

  return (
    <div className="space-y-6">
      {/* Profile */}
      <section className="flex flex-wrap items-center gap-5 rounded-2xl border bg-card p-6 shadow-sm">
        <PhotoEditor
          employeeId={employee.id}
          name={fullName}
          photoVersion={employee.photoVersion}
          onChanged={reload}
          className="size-20 rounded-2xl text-2xl"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="truncate text-2xl font-bold text-foreground">{fullName}</h1>
            <span className="rounded-full bg-primary px-3 py-0.5 text-xs font-semibold capitalize text-primary-foreground">
              {employee.status.replace(/_/g, " ")}
            </span>
            <Button variant="outline" size="sm" render={<Link href="/employee/profile" />}>
              <UserIcon /> View My Profile
            </Button>
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

        <div className="flex flex-col items-stretch gap-1.5 sm:items-end">
          {!checkedIn && (
            <Button size="lg" disabled={busy} onClick={() => punch("check-in")} className="h-11 gap-2 rounded-xl px-6 text-base">
              <LogInIcon className="size-5" />
              {busy ? "Processing…" : "Check In"}
            </Button>
          )}
          {checkedIn && !checkedOut && (
            <Button size="lg" disabled={busy} onClick={() => punch("check-out")} className="h-11 gap-2 rounded-xl px-6 text-base">
              <LogOutIcon className="size-5" />
              {busy ? "Processing…" : "Check Out"}
            </Button>
          )}
          {checkedOut && (
            <span className="inline-flex h-11 items-center rounded-xl border border-sky-200 bg-sky-50 px-5 text-sm font-semibold text-sky-700">
              Done for today
            </span>
          )}
          <p className="text-xs text-muted-foreground sm:text-right">
            {record?.checkIn ? (
              <>
                In <strong className="text-foreground">{timeOf(record.checkIn)}</strong>
                {record.checkOut && (
                  <>
                    {" "}· Out <strong className="text-foreground">{timeOf(record.checkOut)}</strong>
                  </>
                )}
              </>
            ) : (
              <>Not checked in · Shift starts {shiftLabel}</>
            )}
            {" · "}
            <Link href="/employee/tickets" className="font-medium text-primary hover:underline">
              Regularize
            </Link>
          </p>
        </div>
      </section>

      {/* KPIs */}
      <section className="grid gap-5 sm:grid-cols-2" aria-label="Summary">
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

      {punchDialog}
    </div>
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
