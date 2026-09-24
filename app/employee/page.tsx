"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  BanknoteIcon,
  BellIcon,
  CalendarCheckIcon,
  ClipboardListIcon,
  FileTextIcon,
} from "lucide-react";

import { StatCard } from "@/components/hr/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

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

export default function EmployeeDashboardPage() {
  const [todayAttendance, setTodayAttendance] = useState<TodayAttendance | null>(null);
  const [attendanceCount, setAttendanceCount] = useState(0);
  const [pendingLeaves, setPendingLeaves] = useState(0);
  const [leaveBalanceCount, setLeaveBalanceCount] = useState(0);
  const [payslipCount, setPayslipCount] = useState(0);
  const [documentCount, setDocumentCount] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const [checkinLoading, setCheckinLoading] = useState(false);
  const [checkinMsg, setCheckinMsg] = useState("");

  async function loadAll() {
    try {
      setLoading(true);

      const [todayRes, attendanceRes, leaveRes, balancesRes, payslipRes, docRes, notifRes] =
        await Promise.all([
          fetch("/api/attendance/today"),
          fetch("/api/employee/attendance"),
          fetch("/api/employee/leave-requests"),
          fetch("/api/employee/leave-balances"),
          fetch("/api/employee/payslips"),
          fetch("/api/employee/documents"),
          fetch("/api/employee/notifications"),
        ]);

      if (todayRes.ok) setTodayAttendance(await todayRes.json());

      if (attendanceRes.ok) {
        const d = await attendanceRes.json();
        setAttendanceCount(Array.isArray(d) ? d.length : 0);
      }

      if (leaveRes.ok) {
        const d = await leaveRes.json();
        setPendingLeaves(
          Array.isArray(d)
            ? d.filter((l: { status: string }) => l.status === "pending").length
            : 0,
        );
      }

      if (balancesRes.ok) {
        const d = await balancesRes.json();
        setLeaveBalanceCount(Array.isArray(d) ? d.length : 0);
      }

      if (payslipRes.ok) {
        const d = await payslipRes.json();
        setPayslipCount(Array.isArray(d) ? d.length : 0);
      }

      if (docRes.ok) {
        const d = await docRes.json();
        setDocumentCount(Array.isArray(d) ? d.length : 0);
      }

      if (notifRes.ok) {
        const d = await notifRes.json();
        setUnreadCount(
          Array.isArray(d) ? d.filter((n: { isRead: boolean }) => !n.isRead).length : 0,
        );
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  async function handleCheckIn() {
    setCheckinLoading(true);
    setCheckinMsg("");
    try {
      const res = await fetch("/api/attendance/check-in", { method: "POST" });
      const d = await res.json();
      if (!res.ok) setCheckinMsg(d.error ?? "Check-in failed");
      else {
        setCheckinMsg("Checked in successfully!");
        await loadAll();
      }
    } catch {
      setCheckinMsg("Check-in failed");
    } finally {
      setCheckinLoading(false);
    }
  }

  async function handleCheckOut() {
    setCheckinLoading(true);
    setCheckinMsg("");
    try {
      const res = await fetch("/api/attendance/check-out", { method: "POST" });
      const d = await res.json();
      if (!res.ok) setCheckinMsg(d.error ?? "Check-out failed");
      else {
        setCheckinMsg("Checked out successfully!");
        await loadAll();
      }
    } catch {
      setCheckinMsg("Check-out failed");
    } finally {
      setCheckinLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-24 w-full rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    );
  }

  const today = todayAttendance?.attendance ?? null;
  const alreadyCheckedIn = !!today?.checkIn;
  const alreadyCheckedOut = !!today?.checkOut;
  const checkinMsgIsError = checkinMsg.includes("failed") || checkinMsg.includes("Error");

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Attendance Records" value={attendanceCount} icon={CalendarCheckIcon} />
        <StatCard label="Pending Leaves" value={pendingLeaves} icon={ClipboardListIcon} />
        <StatCard label="Leave Balances" value={leaveBalanceCount} icon={ClipboardListIcon} />
        <StatCard label="Payslips" value={payslipCount} icon={BanknoteIcon} />
        <StatCard label="Documents" value={documentCount} icon={FileTextIcon} />
        <StatCard label="Unread Notifications" value={unreadCount} icon={BellIcon} />
      </div>

      <Card className="overflow-hidden border-0 bg-sidebar text-sidebar-foreground shadow-md">
        <CardContent className="px-6 py-5">
          <p className="text-xs font-medium uppercase tracking-wider text-sidebar-foreground/45">
            Today&apos;s attendance
          </p>
          <p className="mt-1 text-sm text-sidebar-foreground/60">
            {todayAttendance?.today ?? "—"}
          </p>

          {today ? (
            <div className="mt-4 mb-5 grid gap-3 sm:grid-cols-2">
              <div className="flex items-center gap-3 rounded-lg bg-sidebar-accent/50 p-3.5">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-sidebar-accent text-sidebar-primary">
                  <CalendarCheckIcon className="size-4.5" />
                </div>
                <div>
                  <p className="text-xs text-sidebar-foreground/45">Check In</p>
                  <p className="mt-0.5 font-semibold text-sidebar-foreground">
                    {today.checkIn ? new Date(today.checkIn).toLocaleTimeString() : "—"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-lg bg-sidebar-accent/50 p-3.5">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-sidebar-accent text-sidebar-primary">
                  <CalendarCheckIcon className="size-4.5" />
                </div>
                <div>
                  <p className="text-xs text-sidebar-foreground/45">Check Out</p>
                  <p className="mt-0.5 font-semibold text-sidebar-foreground">
                    {today.checkOut ? new Date(today.checkOut).toLocaleTimeString() : "Not yet"}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <p className="mt-4 mb-5 text-sm text-sidebar-foreground/60">
              No attendance record for today.
            </p>
          )}

          <div className="flex items-center gap-3">
            {!alreadyCheckedIn && (
              <Button disabled={checkinLoading} onClick={handleCheckIn}>
                {checkinLoading ? "Processing…" : "Check In"}
              </Button>
            )}
            {alreadyCheckedIn && !alreadyCheckedOut && (
              <Button disabled={checkinLoading} onClick={handleCheckOut}>
                {checkinLoading ? "Processing…" : "Check Out"}
              </Button>
            )}
            {alreadyCheckedOut && <Badge>Completed for today</Badge>}
          </div>

          {checkinMsg && (
            <p
              className={`mt-3 text-sm ${checkinMsgIsError ? "text-destructive" : "text-sidebar-foreground/70"}`}
            >
              {checkinMsg}
            </p>
          )}
        </CardContent>
      </Card>

      <div>
        <p className="mb-3 text-sm font-semibold text-foreground">Quick actions</p>
        <div className="grid grid-cols-3 gap-3">
          <QuickActionTile
            href="/employee/leave"
            icon={ClipboardListIcon}
            label="Request leave"
          />
          <QuickActionTile
            href="/employee/attendance"
            icon={CalendarCheckIcon}
            label="Attendance"
          />
          <QuickActionTile
            href="/employee/payslips"
            icon={BanknoteIcon}
            label="Payslips"
          />
        </div>
      </div>
    </div>
  );
}

function QuickActionTile({
  href,
  icon: Icon,
  label,
}: {
  href: string;
  icon: typeof CalendarCheckIcon;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="flex flex-col items-center gap-2 rounded-xl border bg-card px-3 py-4 text-center shadow-sm transition hover:border-primary/30 hover:bg-accent"
    >
      <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="size-5" />
      </div>
      <p className="text-xs font-medium text-foreground">{label}</p>
    </Link>
  );
}
