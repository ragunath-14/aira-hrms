"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronsUpDownIcon, KeyRoundIcon, LockIcon, LogOutIcon, ShieldCheckIcon } from "lucide-react";
import { ChangePasswordDialog } from "@/components/shared/change-password-dialog";
import { TwoFactorDialog } from "@/components/shared/two-factor-dialog";
import { authClient } from "@/lib/auth/client";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type NavItem = {
  label: string;
  href: string;
  icon: React.ReactNode;
  showUnreadDot?: boolean;
  // When set, only these membership roles see the link.
  roles?: string[];
};

type TenantContext = {
  user: { name: string; email: string };
  tenant: { name: string; slug: string };
  membership: { role: string };
};

const mainItems: NavItem[] = [
  {
    label: "Dashboard",
    href: "/",
    icon: <DashboardIcon />,
  },
];

const organizationItems: NavItem[] = [
  {
    label: "Company Profile",
    href: "/organization",
    icon: <BuildingIcon />,
  },
  {
    label: "Departments",
    href: "/departments",
    icon: <DepartmentIcon />,
  },
  {
    label: "Designations",
    href: "/designations",
    icon: <DesignationIcon />,
  },
  {
    label: "Locations",
    href: "/locations",
    icon: <LocationIcon />,
  },
  {
    label: "Reporting Structure",
    href: "/reporting-structure",
    icon: <HierarchyIcon />,
  },
];

const employeeItems: NavItem[] = [
  {
    label: "All Employees",
    href: "/employees",
    icon: <UsersIcon />,
  },
];

const attendanceItems: NavItem[] = [
  {
    label: "Attendance",
    href: "/attendance",
    icon: <CalendarIcon />,
  },
  {
    label: "Team Presence",
    href: "/workplace",
    icon: <UsersIcon />,
  },
];

const leaveItems: NavItem[] = [
  {
    label: "Leave",
    href: "/leave",
    icon: <LeaveIcon />,
  },
];

const payrollItems: NavItem[] = [
  {
    label: "Salary Structure",
    href: "/salary",
    icon: <MoneyIcon />,
  },
  {
    label: "Payroll",
    href: "/payroll",
    icon: <WalletIcon />,
  },
  {
    label: "Statutory Report",
    href: "/statutory-report",
    icon: <ReportIcon />,
  },
];

const performanceItems: NavItem[] = [
  {
    label: "Performance",
    href: "/performance",
    icon: <PerformanceIcon />,
  },
];

const reportItems: NavItem[] = [
  {
    label: "Reports",
    href: "/reports",
    icon: <ReportIcon />,
  },
];

const engagementItems: NavItem[] = [
  {
    label: "Holidays",
    href: "/holidays",
    icon: <CalendarIcon />,
  },
  {
    label: "Announcements",
    href: "/announcements",
    icon: <ReportIcon />,
  },
];

const workplaceItems: NavItem[] = [
  { label: "Expense Claims", href: "/expenses", icon: <MoneyIcon /> },
  { label: "Shift Roster", href: "/shifts", icon: <CalendarIcon /> },
  { label: "Onboarding", href: "/onboarding", icon: <UsersIcon /> },
  { label: "Helpdesk", href: "/tickets", icon: <BellIcon /> },
  { label: "Recruitment", href: "/recruitment", icon: <PerformanceIcon />, roles: ["owner", "admin", "hr"] },
];

const otherItems: NavItem[] = [
  {
    label: "Notifications",
    href: "/notifications",
    icon: <BellIcon />,
    showUnreadDot: true,
  },
];

const settingsItems: NavItem[] = [
  {
    label: "Company",
    href: "/settings/company",
    icon: <BuildingIcon />,
  },
  {
    label: "Users",
    href: "/settings/users",
    icon: <UsersIcon />,
  },
  {
    label: "Roles & Permissions",
    href: "/settings/roles",
    icon: <HierarchyIcon />,
  },
  {
    label: "System Settings",
    href: "/settings/system",
    icon: <PerformanceIcon />,
  },
  {
    label: "Payroll Compliance",
    href: "/settings/payroll-compliance",
    icon: <MoneyIcon />,
  },
  {
    label: "Plan & Usage",
    href: "/settings/plan",
    icon: <HierarchyIcon />,
  },
  {
    label: "Audit Logs",
    href: "/settings/audit-logs",
    icon: <ReportIcon />,
  },
];

const workspaceItems: NavItem[] = [
  {
    label: "My Workspace",
    href: "/employee",
    icon: <UsersIcon />,
  },
];


const HR_ROLES = ["owner", "admin", "hr"];

const NAV_SECTIONS: { title: string; items: NavItem[] }[] = [
  { title: "Main", items: mainItems },
  { title: "Organization", items: organizationItems },
  { title: "Employees", items: employeeItems },
  { title: "Attendance", items: attendanceItems },
  { title: "Leave", items: leaveItems },
  { title: "Payroll", items: payrollItems.map((i) => ({ ...i, roles: HR_ROLES })) },
  { title: "Performance", items: performanceItems.map((i) => ({ ...i, roles: HR_ROLES })) },
  { title: "Reports", items: reportItems },
  { title: "Company", items: engagementItems },
  { title: "Workplace", items: workplaceItems },
  { title: "Other", items: otherItems },
  {
    title: "Settings",
    items: settingsItems.map((i) => ({
      ...i,
      roles:
        i.href === "/settings/audit-logs" || i.href === "/settings/plan"
          ? ["owner", "admin"]
          : HR_ROLES,
    })),
  },
  { title: "My Workspace", items: workspaceItems },
];

export default function Sidebar({
  mobileOpen = false,
  onClose,
}: {
  mobileOpen?: boolean;
  onClose?: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [ctx, setCtx] = useState<TenantContext | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);

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
  }, []);

  const [passwordOpen, setPasswordOpen] = useState(false);
  const [twoFactorOpen, setTwoFactorOpen] = useState(false);

  async function handleLogout() {
    await authClient.signOut();
    router.push("/login");
  }

  const userInitial = (ctx?.user?.name ?? "?").charAt(0).toUpperCase();

  return (
    <>
    {mobileOpen && (
      <div
        className="fixed inset-0 z-40 bg-black/50 lg:hidden"
        onClick={onClose}
        aria-hidden="true"
      />
    )}
    <aside
      className={`fixed inset-y-0 left-0 z-50 w-64 max-w-[85vw] border-r border-sidebar-border bg-sidebar lg:z-40 lg:flex lg:flex-col ${
        mobileOpen ? "flex flex-col shadow-2xl" : "hidden"
      }`}
    >
      {/* Logo */}
      <div className="flex h-16 items-center border-b border-sidebar-border px-5">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-primary text-sm font-bold text-sidebar-primary-foreground">
            HR
          </div>

          <p className="text-base font-bold text-sidebar-foreground">
            AIRA HRMS
          </p>
        </Link>
      </div>

      {/* Workspace switcher */}
      <div className="px-3 pt-4">
        <p className="mb-1.5 px-1 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/35">
          Workspace
        </p>
        <div className="flex items-center gap-2.5 rounded-lg border border-sidebar-border bg-sidebar-accent/40 px-2.5 py-2">
          <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-sidebar-accent text-xs font-bold text-sidebar-accent-foreground">
            {(ctx?.tenant?.name ?? "?").charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-sidebar-foreground">
              {ctx?.tenant?.name ?? "Loading…"}
            </p>
            <p className="truncate text-[11px] text-sidebar-foreground/45">
              {ctx?.tenant?.slug ? `${ctx.tenant.slug}.aira-hrms` : "Isolated workspace"}
            </p>
          </div>
          <ChevronsUpDownIcon className="size-3.5 shrink-0 text-sidebar-foreground/35" />
        </div>
      </div>

      {/* Navigation */}
<nav className="flex-1 overflow-y-auto px-3 py-5">
        {NAV_SECTIONS.map((section) => (
          <NavSection
            key={section.title}
            title={section.title}
            items={section.items}
            pathname={pathname}
            unreadCount={unreadCount}
            role={ctx?.membership?.role}
          />
        ))}
      </nav>

      {/* Bottom: user card */}
      <div className="border-t border-sidebar-border p-3">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button
                type="button"
                className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition hover:bg-sidebar-accent"
              />
            }
          >
            <Avatar size="sm">
              <AvatarFallback className="bg-sidebar-accent font-semibold text-sidebar-accent-foreground">
                {userInitial}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-sidebar-foreground">
                {ctx?.user?.name ?? "—"}
              </p>
              <p className="truncate text-xs capitalize text-sidebar-foreground/45">
                {ctx?.membership?.role ?? ""}
              </p>
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="top" className="w-56">
            <DropdownMenuGroup>
              <DropdownMenuLabel>
                <p className="text-sm font-medium text-foreground">
                  {ctx?.user?.name ?? "—"}
                </p>
                <p className="truncate text-xs font-normal text-muted-foreground">
                  {ctx?.user?.email ?? ""}
                </p>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setPasswordOpen(true)}>
              <KeyRoundIcon />
              Change password
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTwoFactorOpen(true)}>
              <ShieldCheckIcon />
              Two-factor sign-in
            </DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onClick={handleLogout}>
              <LogOutIcon />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <p className="mt-2 flex items-center gap-1 px-2 text-[11px] text-sidebar-foreground/35">
          <LockIcon className="size-3" />
          Session secure
        </p>

        <ChangePasswordDialog open={passwordOpen} onOpenChange={setPasswordOpen} />
        <TwoFactorDialog open={twoFactorOpen} onOpenChange={setTwoFactorOpen} />
      </div>
    </aside>
    </>
  );
}

function NavSection({
  title,
  items,
  pathname,
  unreadCount,
  role,
}: {
  title: string;
  items: NavItem[];
  pathname: string;
  unreadCount: number;
  role: string | undefined;
}) {
  // Links a role cannot use (their API would answer 403) are hidden rather
  // than shown. Until the role is known, restricted links stay hidden too.
  const visible = items.filter(
    (item) => !item.roles || (role !== undefined && item.roles.includes(role)),
  );

  if (visible.length === 0) {
    return null;
  }

  return (
    <div className="mb-4">
      <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/35">
        {title}
      </p>

      <div className="space-y-0.5">
        {visible.map((item) => (
          <SidebarLink
            key={item.href}
            item={item}
            active={isActive(pathname, item.href)}
            unreadCount={unreadCount}
          />
        ))}
      </div>
    </div>
  );
}

function SidebarLink({
  item,
  active,
  unreadCount,
}: {
  item: NavItem;
  active: boolean;
  unreadCount?: number;
}) {
  return (
    <Link
      href={item.href}
      className={[
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition",
        active
          ? "bg-sidebar-primary text-sidebar-primary-foreground"
          : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
      ].join(" ")}
    >
      <span
        className={
          active
            ? "text-sidebar-primary-foreground"
            : "text-sidebar-foreground/40"
        }
      >
        {item.icon}
      </span>

      <span className="flex-1">{item.label}</span>

      {item.showUnreadDot && !!unreadCount && (
        <span className="size-1.5 shrink-0 rounded-full bg-destructive" />
      )}
    </Link>
  );
}

function isActive(pathname: string, href: string) {
  if (href === "/") {
    return pathname === "/";
  }

  return (
    pathname === href ||
    pathname.startsWith(`${href}/`)
  );
}

/* Icons */

function DashboardIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.8" />
      <rect x="14" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.8" />
      <rect x="3" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.8" />
      <rect x="14" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="1.8" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="4" width="18" height="17" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M16 2v4M8 2v4M3 10h18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function LeaveIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M4 19h16M6 19V9l6-4 6 4v10M9 19v-5h6v5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function WalletIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="5" width="18" height="15" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M3 9h18M16 14h2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function PerformanceIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M4 19V5M4 19h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="m8 15 3-4 3 2 5-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ReportIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M6 2h9l4 4v16H6z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M14 2v5h5M9 13h6M9 17h6M9 9h2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function BuildingIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M4 21V5l8-3 8 3v16M2 21h20M8 8h2M14 8h2M8 12h2M14 12h2M8 16h2M14 16h2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function DepartmentIcon() {
  return <UsersIcon />;
}

function DesignationIcon() {
  return <PerformanceIcon />;
}

function LocationIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}
function HierarchyIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <rect
        x="9"
        y="3"
        width="6"
        height="4"
        rx="1"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <rect
        x="3"
        y="17"
        width="6"
        height="4"
        rx="1"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <rect
        x="15"
        y="17"
        width="6"
        height="4"
        rx="1"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M12 7v5M6 17v-2h12v2M18 15v2"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function BellIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function MoneyIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M10 17l5-5-5-5M15 12H3M21 19V5a2 2 0 0 0-2-2h-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}