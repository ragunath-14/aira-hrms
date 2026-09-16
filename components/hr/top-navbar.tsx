"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const pageNames: Record<string, string> = {
  "/": "Dashboard",
  "/employees": "Employees",
  "/attendance": "Attendance",
  "/leave": "Leave Management",
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

  useEffect(() => {
    fetch("/api/tenant")
      .then((r) => r.json())
      .then((data) => {
        if (data?.user && data?.tenant && data?.membership) {
          setCtx(data);
        }
      })
      .catch(() => {/* silently ignore */});
  }, []);

  const pageName =
    pageNames[pathname] ||
    pathname
      .split("/")
      .filter(Boolean)
      .pop()
      ?.replace(/-/g, " ") ||
    "Dashboard";

  const userName = ctx?.user?.name ?? "—";
  const userRole = ctx?.membership?.role ?? "";
  const initial = userName.charAt(0).toUpperCase();

  return (
    <header className="sticky top-0 z-30 h-16 border-b border-gray-200 bg-white">
      <div className="flex h-full items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Left */}
        <div className="flex items-center gap-4">
          <div className="lg:hidden">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-sm font-bold text-white">
              HR
            </div>
          </div>

          <div>
            <p className="text-xs text-gray-400">
              HRMS
            </p>

            <h1 className="text-sm font-semibold capitalize text-gray-900">
              {pageName}
            </h1>
          </div>
        </div>

        {/* Right */}
        <div className="flex items-center gap-3">
          {/* Search */}
          <button
            type="button"
            className="hidden h-9 items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm text-gray-400 transition hover:bg-gray-100 md:flex"
          >
            <SearchIcon />

            <span>Search</span>

            <kbd className="ml-4 rounded border border-gray-200 bg-white px-1.5 py-0.5 text-[10px] text-gray-400">
              /
            </kbd>
          </button>

          {/* Notifications */}
          <button
            type="button"
            aria-label="Notifications"
            className="relative flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 transition hover:bg-gray-100 hover:text-gray-900"
          >
            <BellIcon />

            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-red-500" />
          </button>

          {/* Divider */}
          <div className="hidden h-7 w-px bg-gray-200 sm:block" />

          {/* User */}
          <div className="flex items-center gap-3 rounded-lg px-2 py-1.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-blue-700">
              {initial}
            </div>

            <div className="hidden text-left sm:block">
              <p className="text-sm font-medium text-gray-900">
                {userName}
              </p>

              <p className="text-xs capitalize text-gray-400">
                {userRole}
              </p>
            </div>

            <ChevronIcon />
          </div>
        </div>
      </div>
    </header>
  );
}

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <circle
        cx="11"
        cy="11"
        r="7"
        stroke="currentColor"
        strokeWidth="1.8"
      />

      <path
        d="m20 20-4-4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path
        d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
      <path
        d="m6 9 6 6 6-6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}