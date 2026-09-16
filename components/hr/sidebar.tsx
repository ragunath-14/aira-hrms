"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

type NavItem = {
  label: string;
  href: string;
  icon: React.ReactNode;
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

const otherItems: NavItem[] = [
  {
    label: "Notifications",
    href: "/notifications",
    icon: <BellIcon />,
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
];

const workspaceItems: NavItem[] = [
  {
    label: "My Workspace",
    href: "/employee",
    icon: <UsersIcon />,
  },
];


export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await authClient.signOut();
    router.push("/login");
  }

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-gray-200 bg-white lg:flex lg:flex-col">
      {/* Logo */}
      <div className="flex h-16 items-center border-b border-gray-200 px-6">
        <Link href="/" className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-sm font-bold text-white">
            HR
          </div>

          <div>
            <p className="text-lg font-bold text-gray-900">
              HRMS
            </p>

            <p className="text-[10px] font-medium uppercase tracking-wider text-gray-400">
              Human Resources
            </p>
          </div>
        </Link>
      </div>

      {/* Navigation */}
<nav className="flex-1 overflow-y-auto px-3 py-5">
  <NavSection title="Main">
    {mainItems.map((item) => (
      <SidebarLink
        key={item.href}
        item={item}
        active={isActive(pathname, item.href)}
      />
    ))}
  </NavSection>

  <NavSection title="Organization">
    {organizationItems.map((item) => (
      <SidebarLink
        key={item.href}
        item={item}
        active={isActive(pathname, item.href)}
      />
    ))}
  </NavSection>

  <NavSection title="Employees">
    {employeeItems.map((item) => (
      <SidebarLink
        key={item.href}
        item={item}
        active={isActive(pathname, item.href)}
      />
    ))}
  </NavSection>

  <NavSection title="Attendance">
    {attendanceItems.map((item) => (
      <SidebarLink
        key={item.href}
        item={item}
        active={isActive(pathname, item.href)}
      />
    ))}
  </NavSection>

  <NavSection title="Leave">
    {leaveItems.map((item) => (
      <SidebarLink
        key={item.href}
        item={item}
        active={isActive(pathname, item.href)}
      />
    ))}
  </NavSection>

  <NavSection title="Payroll">
    {payrollItems.map((item) => (
      <SidebarLink
        key={item.href}
        item={item}
        active={isActive(pathname, item.href)}
      />
    ))}
  </NavSection>

  <NavSection title="Performance">
    {performanceItems.map((item) => (
      <SidebarLink
        key={item.href}
        item={item}
        active={isActive(pathname, item.href)}
      />
    ))}
  </NavSection>

  <NavSection title="Reports">
    {reportItems.map((item) => (
      <SidebarLink
        key={item.href}
        item={item}
        active={isActive(pathname, item.href)}
      />
    ))}
  </NavSection>

  <NavSection title="Other">
    {otherItems.map((item) => (
      <SidebarLink
        key={item.href}
        item={item}
        active={isActive(pathname, item.href)}
      />
    ))}
  </NavSection>

  <NavSection title="Settings">
    {settingsItems.map((item) => (
      <SidebarLink
        key={item.href}
        item={item}
        active={isActive(pathname, item.href)}
      />
    ))}
  </NavSection>

  <NavSection title="My Workspace">
    {workspaceItems.map((item) => (
      <SidebarLink
        key={item.href}
        item={item}
        active={isActive(pathname, item.href)}
      />
    ))}
  </NavSection>
</nav>

      {/* Bottom */}
      <div className="border-t border-gray-200 p-3">
        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-gray-600 transition hover:bg-gray-50 hover:text-gray-900"
        >
          <LogoutIcon />
          <span>Sign out</span>
        </button>
      </div>
    </aside>
  );
}

function NavSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-6">
      <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
        {title}
      </p>

      <div className="space-y-1">{children}</div>
    </div>
  );
}

function SidebarLink({
  item,
  active,
}: {
  item: NavItem;
  active: boolean;
}) {
  return (
    <Link
      href={item.href}
      className={[
        "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition",
        active
          ? "bg-blue-50 text-blue-700"
          : "text-gray-600 hover:bg-gray-50 hover:text-gray-900",
      ].join(" ")}
    >
      <span
        className={
          active ? "text-blue-600" : "text-gray-400"
        }
      >
        {item.icon}
      </span>

      <span>{item.label}</span>
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