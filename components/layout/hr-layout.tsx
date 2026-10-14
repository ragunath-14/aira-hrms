"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Sidebar from "@/components/layout/sidebar";
import { PlanBanner } from "@/components/layout/plan-banner";
import TopNavbar from "@/components/layout/top-navbar";
import { useDisplayPrefs } from "@/hooks/use-display-prefs";

export default function HRLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const displayVersion = useDisplayPrefs(!pathname.startsWith("/login"));

  // Close the mobile drawer whenever the user navigates.
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

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
      <Sidebar mobileOpen={menuOpen} onClose={() => setMenuOpen(false)} />

      <div className="lg:pl-64">
        <TopNavbar onMenuClick={() => setMenuOpen(true)} />

        <main key={displayVersion} className="min-h-[calc(100vh-4rem)] p-4 sm:p-6 lg:p-8">
          <PlanBanner />
          {children}
        </main>
      </div>
    </div>
  );
}