"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BellIcon, ChevronDownIcon, LogOutIcon } from "lucide-react";

import { authClient } from "@/lib/auth-client";
import { RouteTabs } from "@/components/hr/route-tabs";
import { StatusBadge } from "@/components/hr/status-badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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

type EmployeeProfile = {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string | null;
  email: string;
  phone: string | null;
  dateOfJoining: string | null;
  status: string;
};

type EmployeeContextValue = {
  employee: EmployeeProfile | null;
  reload: () => Promise<void>;
};

const EmployeeContext = createContext<EmployeeContextValue>({
  employee: null,
  reload: async () => {},
});

export function useEmployee() {
  return useContext(EmployeeContext);
}

const NAV_SECTIONS = [
  { href: "/employee", label: "Dashboard", exact: true },
  { href: "/employee/attendance", label: "Attendance" },
  { href: "/employee/leave", label: "Leave" },
  { href: "/employee/payslips", label: "Payslips" },
  { href: "/employee/documents", label: "Documents" },
  { href: "/employee/notifications", label: "Notifications" },
];

export default function EmployeeLayout({
  children,
}: {
  children: ReactNode;
}) {
  const [employee, setEmployee] = useState<EmployeeProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [unreadCount, setUnreadCount] = useState(0);

  const router = useRouter();

  const loadProfile = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const res = await fetch("/api/employee/profile");
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? "Failed to load profile");
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
        <div className="mx-auto max-w-6xl space-y-6">
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
        <div className="w-full max-w-md rounded-xl border border-destructive/20 bg-destructive/10 p-6 text-destructive">
          <p className="font-semibold">Error loading portal</p>
          <p className="mt-1 text-sm">
            {error || "Employee record not found"}
          </p>
          <p className="mt-3 text-sm text-muted-foreground">
            Please make sure you are logged in and your account has an
            associated employee record.
          </p>
        </div>
      </main>
    );
  }

  const initials =
    `${employee.firstName[0] ?? ""}${employee.lastName?.[0] ?? ""}`.toUpperCase();

  return (
    <EmployeeContext.Provider value={{ employee, reload: loadProfile }}>
      <div className="min-h-screen bg-muted/40">
        <header className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur supports-backdrop-filter:bg-card/80">
          <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
            <Link href="/employee" className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
                HR
              </div>
              <div className="hidden sm:block">
                <p className="text-sm font-bold leading-tight text-foreground">
                  AIRA HRMS
                </p>
                <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  My Workspace
                </p>
              </div>
            </Link>

            <div className="flex items-center gap-3">
              <Link
                href="/employee/notifications"
                aria-label="Notifications"
                className="relative flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground"
              >
                <BellIcon className="size-4.5" />
                {unreadCount > 0 && (
                  <span className="absolute right-1.5 top-1.5 flex h-2 w-2 items-center justify-center rounded-full bg-destructive" />
                )}
              </Link>

              <div className="hidden h-7 w-px bg-border sm:block" />

              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <button
                      type="button"
                      className="flex items-center gap-2 rounded-lg py-1 pl-1 pr-2 transition hover:bg-muted"
                    />
                  }
                >
                  <Avatar size="sm">
                    <AvatarFallback className="bg-accent font-semibold text-accent-foreground">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="hidden text-left sm:block">
                    <p className="text-sm font-medium leading-tight text-foreground">
                      {employee.firstName}
                      {employee.lastName ? ` ${employee.lastName}` : ""}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {employee.employeeCode}
                    </p>
                  </div>
                  <ChevronDownIcon className="size-3.5 text-muted-foreground" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuGroup>
                    <DropdownMenuLabel>
                      <p className="text-sm font-medium text-foreground">
                        {employee.firstName}
                        {employee.lastName ? ` ${employee.lastName}` : ""}
                      </p>
                      <p className="truncate text-xs font-normal text-muted-foreground">
                        {employee.email}
                      </p>
                    </DropdownMenuLabel>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
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
        </header>

        <main className="p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-6xl">
            <div className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card px-5 py-4 shadow-sm">
              <Avatar size="lg">
                <AvatarFallback className="bg-accent font-semibold text-accent-foreground">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <h1 className="truncate text-lg font-bold text-foreground">
                  {employee.firstName}
                  {employee.lastName ? ` ${employee.lastName}` : ""}
                </h1>
                <p className="truncate text-sm text-muted-foreground">
                  {employee.employeeCode} · {employee.email}
                </p>
              </div>
              <div className="ml-auto">
                <StatusBadge status={employee.status} />
              </div>
            </div>

            <RouteTabs
              tabs={NAV_SECTIONS.map((tab) => ({
                ...tab,
                badge:
                  tab.href === "/employee/notifications"
                    ? unreadCount
                    : undefined,
              }))}
            />

            {children}
          </div>
        </main>
      </div>
    </EmployeeContext.Provider>
  );
}
