"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { BellIcon } from "lucide-react";
import Link from "next/link";

const pageNames: Record<string, string> = {
  "/": "Overview",
  "/employees": "Employees",
  "/attendance": "Attendance",
  "/leave": "Leave",
  "/payroll": "Payroll",
  "/salary": "Salary Management",
  "/performance": "Performance",
  "/reports": "Reports",
  "/organization": "Company Profile",
  "/departments": "Departments",
  "/designations": "Designations",
  "/locations": "Locations",
  "/notifications": "Notifications",
  "/reporting-structure": "Reporting Structure",
};

type TenantContext = {
  user: { name: string; email: string };
  tenant: { name: string };
  membership: { role: string };
};

export default function TopNavbar() {
  const pathname = usePathname();
  const [ctx, setCtx] = useState<TenantContext | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [today, setToday] = useState("");

  useEffect(() => {
    fetch("/api/tenant")
      .then((r) => r.json())
      .then((data) => {
        if (data?.user && data?.tenant && data?.membership) {
          setCtx(data);
        }
      })
      .catch(() => {
        /* silently ignore */
      });

    fetch("/api/notifications")
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

    setToday(
      new Date().toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }),
    );
  }, []);

  const pageName =
    pageNames[pathname] ||
    pathname
      .split("/")
      .filter(Boolean)
      .pop()
      ?.replace(/-/g, " ") ||
    "Overview";

  return (
    <header className="sticky top-0 z-30 h-12 bg-muted/40">
      <div className="flex h-full items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 text-sm">
          <span className="text-muted-foreground">
            {ctx?.tenant?.name ?? "—"}
          </span>
          <span className="text-muted-foreground/50">/</span>
          <span className="font-medium capitalize text-foreground">
            {pageName}
          </span>
        </div>

        {/* Right */}
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="hidden sm:inline">India · {today}</span>

          <Link
            href="/notifications"
            aria-label="Notifications"
            className="relative flex h-7 w-7 items-center justify-center rounded-lg transition hover:bg-muted hover:text-foreground"
          >
            <BellIcon className="size-4" />
            {unreadCount > 0 && (
              <span className="absolute right-1 top-1 size-1.5 rounded-full bg-destructive" />
            )}
          </Link>

          <span
            className="size-2 rounded-full bg-emerald-500"
            aria-label="Online"
            title="Online"
          />
        </div>
      </div>
    </header>
  );
}
