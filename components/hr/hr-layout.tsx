"use client";

import { usePathname } from "next/navigation";
import Sidebar from "./sidebar";
import TopNavbar from "./top-navbar";

export default function HRLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  /*
   * Do not show HR shell on authentication pages.
   * Employee portal will get its own workspace shell later.
   */
  const isAuthPage =
    pathname === "/login" ||
    pathname === "/signup";

  const isEmployeePortal =
    pathname === "/employee" ||
    pathname.startsWith("/employee/");

  if (isAuthPage || isEmployeePortal) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-muted/40">
      <Sidebar />

      <div className="lg:pl-64">
        <TopNavbar />

        <main className="min-h-[calc(100vh-4rem)] p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}