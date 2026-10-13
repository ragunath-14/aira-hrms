"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BellIcon, ChevronDownIcon, KeyRoundIcon, LayoutDashboardIcon, LogOutIcon, ShieldCheckIcon, UserIcon } from "lucide-react";

import { ChangePasswordDialog } from "@/components/shared/change-password-dialog";
import { TwoFactorDialog } from "@/components/shared/two-factor-dialog";
import { WorkspaceNav } from "@/components/layout/workspace-nav";
import { WorkspaceSearch } from "@/components/layout/workspace-search";
import {
  EmployeeContext,
  type EmployeeProfile,
} from "@/components/layout/employee-context";
import { authClient } from "@/lib/auth/client";
import { usePageTitle } from "@/hooks/use-page-title";
import { useDisplayPrefs } from "@/hooks/use-display-prefs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { errorText } from "@/lib/format/error-text";

// Re-exported so existing imports keep working.
export { useEmployee } from "@/components/layout/employee-context";

const NAV_SECTIONS = [
  { href: "/employee", label: "Dashboard", exact: true },
  { href: "/employee/workplace", label: "Workplace" },
  { href: "/employee/attendance", label: "Attendance" },
  { href: "/employee/leave", label: "Leave" },
  { href: "/employee/payslips", label: "Payslips" },
  { href: "/employee/documents", label: "Documents" },
  { href: "/employee/holidays", label: "Holidays" },
  { href: "/employee/announcements", label: "Announcements" },
  { href: "/employee/expenses", label: "Expenses" },
  { href: "/employee/shifts", label: "Shifts" },
  { href: "/employee/onboarding", label: "Checklist" },
  { href: "/employee/tickets", label: "Help" },
  { href: "/employee/notifications", label: "Notifications" },
  { href: "/employee/profile", label: "My Profile" },
];

// Roles that also have the HR console (everyone except plain employees).
const CONSOLE_ROLES = ["owner", "admin", "hr", "manager"];

// Shown in the nav bar; "My Profile" is reached from the profile card and menu.
const NAV_TABS = NAV_SECTIONS.filter((s) => s.href !== "/employee/profile");

export default function EmployeeShell({
  children,
}: {
  children: ReactNode;
}) {
  const [employee, setEmployee] = useState<EmployeeProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [unreadCount, setUnreadCount] = useState(0);

  const [passwordOpen, setPasswordOpen] = useState(false);
  const [twoFactorOpen, setTwoFactorOpen] = useState(false);
  const displayVersion = useDisplayPrefs();
  const pathnameForTitle = usePathname();
  const section = NAV_SECTIONS.filter(
    (item) =>
      pathnameForTitle === item.href ||
      (!item.exact && pathnameForTitle.startsWith(item.href + "/")),
  ).sort((a, b) => b.href.length - a.href.length)[0];
  usePageTitle(section?.label ?? "My Workspace");

  const router = useRouter();

  const loadProfile = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const res = await fetch("/api/employee/profile");
      const data = await res.json();

      if (!res.ok) {
        throw new Error(errorText(data.error, "Failed to load profile"));
      }

      setEmployee(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load portal");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    fetch("/api/employee/notifications")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        if (Array.isArray(data)) {
          setUnreadCount(
            data.filter((n: { isRead: boolean }) => !n.isRead).length,
          );
        }
      })
      .catch(() => {
        /* silently ignore */
      });
  }, []);

  async function handleLogout() {
    await authClient.signOut();
    router.push("/login");
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-muted/40 p-4 sm:p-6 lg:p-8">
        <div className="mx-auto max-w-[1400px] space-y-6">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </main>
    );
  }

  if (error || !employee) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
        <div className="w-full max-w-md rounded-xl border border-destructive/20 bg-destructive/10 p-6 text-destructive shadow-sm">
          <p className="font-semibold text-base">Error loading portal</p>
          <p className="mt-1 text-sm font-medium">
            {error || "Employee record not found"}
          </p>
          <p className="mt-3 text-sm text-muted-foreground">
            Please make sure you are logged in and your account has an
            associated employee record.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              className="bg-background text-foreground"
              render={<Link href="/" />}
            >
              Back to Dashboard
            </Button>
            <Button onClick={loadProfile} variant="secondary" size="sm">
              Try Again
            </Button>
            <Button onClick={handleLogout} variant="ghost" size="sm">
              Sign Out
            </Button>
          </div>
        </div>
      </main>
    );
  }

  const initials =
    `${employee.firstName[0] ?? ""}${employee.lastName?.[0] ?? ""}`.toUpperCase();
  const fullName = `${employee.firstName}${employee.lastName ? ` ${employee.lastName}` : ""}`;
  const hasConsole = CONSOLE_ROLES.includes(employee.role);

  return (
    <EmployeeContext.Provider value={{ employee, reload: loadProfile, unreadCount }}>
      <div className="flex min-h-screen flex-col bg-muted/40">
        <header className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur supports-backdrop-filter:bg-card/80">
          <div className="mx-auto flex h-16 max-w-[1400px] items-center gap-4 px-4 sm:px-6 lg:px-8">
            <Link href="/employee" className="flex shrink-0 items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-sm font-bold text-primary-foreground shadow-sm ring-2 ring-primary/20">
                HR
              </div>
              <div className="hidden sm:block">
                <p className="flex items-center gap-2 text-base font-bold leading-tight text-foreground">
                  AIRA HRMS
                  <span className="rounded-md border border-primary/25 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
                    {employee.companyName}
                  </span>
                </p>
                <p className="text-xs text-muted-foreground">My Workspace</p>
              </div>
            </Link>

            <div className="mx-auto hidden w-full max-w-xl flex-1 md:block">
              <WorkspaceSearch pages={NAV_TABS} />
            </div>

            <div className="ml-auto flex shrink-0 items-center gap-3 md:ml-0">
              {hasConsole && (
                <Link
                  href="/"
                  title="Leave My Workspace and go back to the HR console"
                  className="inline-flex h-9 items-center gap-2 rounded-full border bg-card px-3.5 text-sm font-semibold text-foreground transition hover:bg-muted"
                >
                  <LayoutDashboardIcon className="size-4 text-primary" />
                  <span className="hidden sm:inline">HR Console</span>
                  <span className="sr-only sm:hidden">HR Console</span>
                </Link>
              )}

              <Link
                href="/employee/notifications"
                aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ""}`}
                className="relative flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground"
              >
                <BellIcon className="size-5" />
                {unreadCount > 0 && (
                  <span className="absolute right-0.5 top-0.5 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-white ring-2 ring-card">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </Link>

              <div className="hidden h-8 w-px bg-border sm:block" />

              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <button
                      type="button"
                      className="flex items-center gap-2.5 rounded-full py-1 pl-1 pr-2 transition hover:bg-muted"
                    />
                  }
                >
                  <span className="relative">
                    <Avatar>
                      <AvatarFallback className="bg-primary/10 font-semibold text-primary">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <span className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full bg-emerald-500 ring-2 ring-card" />
                  </span>
                  <div className="hidden text-left sm:block">
                    <p className="flex items-center gap-2 text-sm font-semibold leading-tight text-foreground">
                      {fullName}
                      <span className="rounded-md border border-emerald-200 bg-emerald-50 px-1.5 py-px text-[10px] font-medium capitalize text-emerald-700">
                        {employee.status.replace(/_/g, " ")}
                      </span>
                    </p>
                    <p className="font-mono text-[11px] text-muted-foreground">
                      {employee.employeeCode}
                    </p>
                  </div>
                  <ChevronDownIcon className="size-4 text-muted-foreground" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuGroup>
                    <DropdownMenuLabel>
                      <p className="text-sm font-medium text-foreground">
                        {fullName}
                      </p>
                      <p className="truncate text-xs font-normal text-muted-foreground">
                        {employee.email}
                      </p>
                    </DropdownMenuLabel>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  {hasConsole && (
                    <DropdownMenuItem onClick={() => router.push("/")}>
                      <LayoutDashboardIcon />
                      Back to HR console
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={() => router.push("/employee/profile")}>
                    <UserIcon />
                    My profile
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setPasswordOpen(true)}>
                    <KeyRoundIcon />
                    Change password
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setTwoFactorOpen(true)}>
                    <ShieldCheckIcon />
                    Two-factor sign-in
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={handleLogout}
                  >
                    <LogOutIcon />
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <div className="px-4 pb-3 md:hidden">
            <WorkspaceSearch pages={NAV_TABS} />
          </div>

          <div className="border-t border-border">
            <WorkspaceNav
              tabs={NAV_TABS.map((tab) => ({
                ...tab,
                badge:
                  tab.href === "/employee/notifications"
                    ? unreadCount
                    : undefined,
              }))}
            />
          </div>
        </header>

        <ChangePasswordDialog open={passwordOpen} onOpenChange={setPasswordOpen} />
        <TwoFactorDialog open={twoFactorOpen} onOpenChange={setTwoFactorOpen} />

        <main key={displayVersion} className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-[1400px]">{children}</div>
        </main>

        <footer className="border-t border-border bg-card">
          <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-3 px-4 py-4 text-sm text-muted-foreground sm:px-6 lg:px-8">
            <p>
              <span className="font-semibold text-foreground">AIRA HRMS</span>
              <span className="mx-2">•</span>
              {employee.companyName}
            </p>
            <nav aria-label="Support" className="flex items-center gap-5">
              <Link href="/employee/tickets" className="hover:text-foreground">
                HR Help Desk
              </Link>
              <Link href="/employee/holidays" className="hover:text-foreground">
                Holiday Calendar
              </Link>
            </nav>
          </div>
        </footer>
      </div>
    </EmployeeContext.Provider>
  );
}
