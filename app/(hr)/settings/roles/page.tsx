"use client";

type PermissionInfo = {
  key: string;
  name: string;
  category: string;
  description: string;
};

const permissionsList: PermissionInfo[] = [
  { key: "tenant:read", name: "Read Company Profile", category: "Company", description: "View company profile details and metadata" },
  { key: "tenant:manage", name: "Manage Company Profile", category: "Company", description: "Update company profile information, settings, and logo" },
  { key: "users:read", name: "Read Team Members", category: "Users", description: "View the list of team members and their roles" },
  { key: "users:manage", name: "Manage Team Members", category: "Users", description: "Invite new users, update user roles, or remove users" },
  { key: "employees:read", name: "Read Employees", category: "Employees", description: "Browse and view employee detailed directory profiles" },
  { key: "employees:manage", name: "Manage Employees", category: "Employees", description: "Add new employees, edit employee data, or offboard profiles" },
  { key: "attendance:read", name: "Read Attendance", category: "Attendance", description: "View attendance logs and timesheets" },
  { key: "attendance:manage", name: "Manage Attendance", category: "Attendance", description: "Record daily attendance, punch-in/out, and edit records" },
  { key: "leave:read", name: "Read Leaves", category: "Leaves", description: "View leave requests and balance allocation" },
  { key: "leave:manage", name: "Manage Leaves", category: "Leaves", description: "Submit requests, allocate leaves, and approve/reject requests" },
  { key: "payroll:read", name: "Read Payroll", category: "Payroll", description: "View payroll salary structures and history slips" },
  { key: "payroll:manage", name: "Manage Payroll", category: "Payroll", description: "Configure salary components, generate, and execute payroll run" },
  { key: "performance:read", name: "Read Performance", category: "Performance", description: "View performance review assessments and objectives" },
  { key: "performance:manage", name: "Manage Performance", category: "Performance", description: "Configure performance goals, reviews, and evaluations" },
];

const rolesList = [
  { key: "owner", name: "Owner", color: "bg-purple-100 text-purple-800 border-purple-200" },
  { key: "admin", name: "Admin", color: "bg-rose-100 text-rose-800 border-rose-200" },
  { key: "hr", name: "HR Partner", color: "bg-sky-100 text-sky-800 border-sky-200" },
  { key: "manager", name: "Manager", color: "bg-amber-100 text-amber-800 border-amber-200" },
  { key: "employee", name: "Employee", color: "bg-blue-100 text-blue-800 border-blue-200" },
  { key: "member", name: "Member", color: "bg-gray-100 text-gray-800 border-gray-200" },
];

// Helper mapping matching lib/permissions.ts
function hasPermission(role: string, permissionKey: string): boolean {
  switch (role) {
    case "owner":
      return true; // Owner has all permissions
    case "admin":
    case "hr":
      // All except tenant:manage
      return permissionKey !== "tenant:manage";
    case "manager":
      // tenant:read, employees:read, attendance:read, attendance:manage, leave:read, leave:manage, performance:read, performance:manage
      return [
        "tenant:read",
        "employees:read",
        "attendance:read",
        "attendance:manage",
        "leave:read",
        "leave:manage",
        "performance:read",
        "performance:manage",
      ].includes(permissionKey);
    case "employee":
    case "member":
      // tenant:read, attendance:read, attendance:manage, leave:read, leave:manage, payroll:read, performance:read
      return [
        "tenant:read",
        "attendance:read",
        "attendance:manage",
        "leave:read",
        "leave:manage",
        "payroll:read",
        "performance:read",
      ].includes(permissionKey);
    default:
      return false;
  }
}

export default function RolesPermissionsPage() {
  // Group permissions by category for easier display
  const categories = Array.from(new Set(permissionsList.map((p) => p.category)));

  return (
    <div className="mx-auto max-w-7xl space-y-8 font-sans">
      <div className="border-b border-gray-200 pb-4">
        <h1 className="text-3xl font-extrabold tracking-tight text-gray-900">Roles & Permissions</h1>
        <p className="mt-1.5 text-sm text-gray-500">
          Access matrix showing granular permissions configured for each organization role.
        </p>
      </div>

      <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm text-gray-500">
            <thead className="bg-gray-50 text-xs font-bold uppercase tracking-wider text-gray-400 border-b border-gray-100">
              <tr>
                <th className="px-6 py-4 min-w-[280px]">Module & Permission</th>
                {rolesList.map((role) => (
                  <th key={role.key} className="px-4 py-4 text-center">
                    <span className={`inline-block rounded-md border px-2 py-0.5 text-xs font-semibold ${role.color}`}>
                      {role.name}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {categories.map((category) => (
                <tr key={category} className="bg-gray-50/50">
                  <td colSpan={rolesList.length + 1} className="px-6 py-2.5 text-xs font-bold uppercase tracking-wider text-blue-600 bg-blue-50/20">
                    {category} Management
                  </td>
                </tr>
              ))}
              {categories.flatMap((cat) =>
                permissionsList
                  .filter((p) => p.category === cat)
                  .map((perm) => (
                    <tr key={perm.key} className="hover:bg-gray-50/30 transition">
                      <td className="px-6 py-4">
                        <p className="font-semibold text-gray-900">{perm.name}</p>
                        <p className="mt-1 text-xs text-gray-400 font-normal">{perm.description}</p>
                      </td>
                      {rolesList.map((role) => {
                        const allowed = hasPermission(role.key, perm.key);
                        return (
                          <td key={role.key} className="px-4 py-4 text-center">
                            {allowed ? (
                              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-emerald-800 shadow-sm">
                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                                </svg>
                              </span>
                            ) : (
                              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 text-gray-400">
                                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
