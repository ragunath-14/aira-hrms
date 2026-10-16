// Custom roles: a company-defined role that takes access AWAY from one of the
// built-in roles (HR, Manager, Admin), by area of the product and by action.
//
// Nothing here can grant access. The built-in role still decides which
// endpoints a person can reach at all; a custom role only narrows that, so a
// mistake in a custom role can make someone less powerful, never more.
//
// Pure and free of server imports, so the browser uses the same rules to
// decide what to show.

export const MODULES = [
  { id: "employees", label: "Employees & organization", hint: "Directory, profiles, departments, designations, locations, onboarding" },
  { id: "attendance", label: "Attendance & shifts", hint: "Attendance records, corrections, shifts and rosters" },
  { id: "leave", label: "Leave & holidays", hint: "Leave requests, types and balances, encashment, holidays" },
  { id: "payroll", label: "Payroll, salary & loans", hint: "Payroll runs, payslips, salary structures, loans, statutory reports, bank file" },
  { id: "recruitment", label: "Recruitment", hint: "Jobs and candidates" },
  { id: "performance", label: "Performance", hint: "Goals and reviews" },
  { id: "reports", label: "Reports & dashboard", hint: "The dashboard and reports" },
  { id: "documents", label: "Employee documents", hint: "Offer letters, ID proofs and other files" },
  { id: "engagement", label: "Announcements, expenses & helpdesk", hint: "Announcements, expense claims, helpdesk tickets, meetings" },
  { id: "settings", label: "Settings, users & roles", hint: "Company settings, users, roles, plan, audit logs" },
] as const;

export type ModuleId = (typeof MODULES)[number]["id"];

export const ACTIONS = ["view", "create", "edit", "delete"] as const;
export type Action = (typeof ACTIONS)[number];

export const ACTION_LABELS: Record<Action, string> = {
  view: "View",
  create: "Add",
  edit: "Change",
  delete: "Delete",
};

// The built-in roles a custom role can start from.
export const BASE_ROLES = [
  { id: "admin", label: "Admin" },
  { id: "hr", label: "HR Partner" },
  { id: "manager", label: "Manager" },
] as const;

export type CustomRolePermissions = Partial<Record<ModuleId, Action[]>>;

const MODULE_IDS = new Set<string>(MODULES.map((m) => m.id));
const ACTION_IDS = new Set<string>(ACTIONS);

// What a custom role may do, cleaned: only known areas and actions, no repeats.
export function sanitizePermissions(raw: unknown): CustomRolePermissions {
  const clean: CustomRolePermissions = {};

  if (!raw || typeof raw !== "object") return clean;

  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!MODULE_IDS.has(key) || !Array.isArray(value)) continue;

    const actions = ACTIONS.filter((a) => (value as unknown[]).includes(a));

    if (actions.length > 0) clean[key as ModuleId] = actions;
  }

  return clean;
}

// Which area an API path belongs to. Ordered, most specific first. Anything not
// listed counts as "settings", so a restricted person never reaches a new
// endpoint just because nobody mapped it.
const API_RULES: [prefix: string, area: ModuleId][] = [
  ["/api/employees/", "employees"], // refined below for statutory and documents
  ["/api/employees", "employees"],
  ["/api/departments", "employees"],
  ["/api/designations", "employees"],
  ["/api/locations", "employees"],
  ["/api/onboarding", "employees"],
  ["/api/attendance", "attendance"],
  ["/api/shifts", "attendance"],
  ["/api/shift-assignments", "attendance"],
  ["/api/leave-requests", "leave"],
  ["/api/leave-types", "leave"],
  ["/api/leave-balances", "leave"],
  ["/api/leave-encashment", "leave"],
  ["/api/leave-adjustment", "leave"],
  ["/api/ltc-claims", "leave"],
  ["/api/holidays", "leave"],
  ["/api/payroll", "payroll"],
  ["/api/payslips", "payroll"],
  ["/api/salary-components", "payroll"],
  ["/api/salary-structures", "payroll"],
  ["/api/loans", "payroll"],
  ["/api/settings/statutory", "payroll"],
  ["/api/settings/payroll-rules", "payroll"],
  ["/api/jobs", "recruitment"],
  ["/api/candidates", "recruitment"],
  ["/api/performance", "performance"],
  ["/api/reports", "reports"],
  ["/api/dashboard", "reports"],
  ["/api/documents", "documents"],
  ["/api/announcements", "engagement"],
  ["/api/expenses", "engagement"],
  ["/api/tickets", "engagement"],
  ["/api/meetings", "engagement"],
];

export function moduleForApiPath(pathname: string): ModuleId {
  // Parts of an employee's record that belong to another area.
  if (/^\/api\/employees\/[^/]+\/statutory/.test(pathname)) return "payroll";
  if (/^\/api\/employees\/[^/]+\/documents/.test(pathname)) return "documents";

  for (const [prefix, area] of API_RULES) {
    if (pathname === prefix || pathname.startsWith(prefix.endsWith("/") ? prefix : `${prefix}/`)) {
      return area;
    }
  }

  return "settings";
}

export function actionForMethod(method: string): Action {
  switch (method.toUpperCase()) {
    case "POST":
      return "create";
    case "PUT":
    case "PATCH":
      return "edit";
    case "DELETE":
      return "delete";
    default:
      return "view";
  }
}

// Null when allowed, otherwise the reason to show.
export function denialFor(
  roleName: string,
  permissions: CustomRolePermissions,
  pathname: string,
  method: string,
) {
  const area = moduleForApiPath(pathname);
  const action = actionForMethod(method);

  if (permissions[area]?.includes(action)) return null;

  const label = MODULES.find((m) => m.id === area)?.label ?? area;

  return `Your role "${roleName}" does not allow you to ${ACTION_LABELS[action].toLowerCase()} in ${label}.`;
}

// Which area a page in the HR console belongs to (for hiding menu links).
// Pages with no area (the dashboard, My Workspace) are always shown.
const PAGE_RULES: [prefix: string, area: ModuleId][] = [
  ["/settings", "settings"],
  ["/employees", "employees"],
  ["/departments", "employees"],
  ["/designations", "employees"],
  ["/locations", "employees"],
  ["/reporting-structure", "employees"],
  ["/organization", "employees"],
  ["/onboarding", "employees"],
  ["/attendance", "attendance"],
  ["/shifts", "attendance"],
  ["/leave", "leave"],
  ["/holidays", "leave"],
  ["/salary", "payroll"],
  ["/payroll", "payroll"],
  ["/statutory-report", "payroll"],
  ["/loans", "payroll"],
  ["/recruitment", "recruitment"],
  ["/performance", "performance"],
  ["/reports", "reports"],
  ["/muster-report", "reports"],
  ["/announcements", "engagement"],
  ["/expenses", "engagement"],
  ["/tickets", "engagement"],
];

export function moduleForPage(href: string): ModuleId | null {
  for (const [prefix, area] of PAGE_RULES) {
    if (href === prefix || href.startsWith(`${prefix}/`)) return area;
  }

  return null;
}

export function canViewPage(permissions: CustomRolePermissions | null | undefined, href: string) {
  if (!permissions) return true;

  const area = moduleForPage(href);

  return area === null || Boolean(permissions[area]?.includes("view"));
}
