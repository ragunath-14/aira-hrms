import { and, eq } from "drizzle-orm";

import { db } from "./index";
import { auth } from "../lib/auth";
import { user as authUsers } from "./schema/auth";
import { users } from "./schema/users";
import { tenants } from "./schema/tenants";
import { memberships } from "./schema/memberships";
import { departments, designations, locations } from "./schema/organization";
import { employees } from "./schema/employees";
import {
  leaveTypes,
  leaveBalances,
  leaveRequests,
} from "./schema/leaves";
import {
  salaryStructures,
  salaryComponents,
  payrollRuns,
} from "./schema/payroll";
import { attendance } from "./schema/attendance";
import { performanceGoals } from "./schema/performance-goals";
import { performanceReviews } from "./schema/performance";
import { permissions, roles, rolePermissions } from "./schema/rbac";
import {
  PERMISSIONS,
  ROLES,
  getRolePermissions,
} from "../lib/permissions";
import { createPayrollRecordWithRun } from "../lib/payroll";

const DEMO_PASSWORD = "Passw0rd!123";

type SeedUser = {
  role: "owner" | "hr" | "manager" | "employee";
  name: string;
  email: string;
};

type TenantSeed = {
  name: string;
  slug: string;
  email: string;
  city: string;
  users: SeedUser[];
};

const TENANTS: TenantSeed[] = [
  {
    name: "Acme Corp",
    slug: "acme-corp",
    email: "hello@acme-corp.test",
    city: "Bengaluru",
    users: [
      { role: "owner", name: "Alice Owner", email: "owner@acme-corp.test" },
      { role: "hr", name: "Hank HR", email: "hr@acme-corp.test" },
      { role: "manager", name: "Mona Manager", email: "manager@acme-corp.test" },
      { role: "employee", name: "Eddie Employee", email: "employee@acme-corp.test" },
    ],
  },
  {
    name: "Globex Inc",
    slug: "globex-inc",
    email: "hello@globex-inc.test",
    city: "New York",
    users: [
      { role: "owner", name: "Gina Owner", email: "owner@globex-inc.test" },
      { role: "hr", name: "Harold HR", email: "hr@globex-inc.test" },
      { role: "manager", name: "Marcus Manager", email: "manager@globex-inc.test" },
      { role: "employee", name: "Elena Employee", email: "employee@globex-inc.test" },
    ],
  },
];

const SUPER_ADMIN = {
  name: "Platform Admin",
  email: "superadmin@platform.test",
};

const ROLE_DISPLAY: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  hr: "HR Partner",
  manager: "Manager",
  employee: "Employee",
  member: "Member",
};

const PERMISSION_DISPLAY: Record<string, { name: string; description: string }> = {
  "tenant:read": { name: "Read Company Profile", description: "View company profile details and metadata" },
  "tenant:manage": { name: "Manage Company Profile", description: "Update company profile information, settings, and logo" },
  "users:read": { name: "Read Team Members", description: "View the list of team members and their roles" },
  "users:manage": { name: "Manage Team Members", description: "Invite new users, update user roles, or remove users" },
  "employees:read": { name: "Read Employees", description: "Browse and view employee directory profiles" },
  "employees:manage": { name: "Manage Employees", description: "Add new employees, edit employee data, or offboard profiles" },
  "attendance:read": { name: "Read Attendance", description: "View attendance logs and timesheets" },
  "attendance:manage": { name: "Manage Attendance", description: "Record daily attendance, punch-in/out, and edit records" },
  "leave:read": { name: "Read Leaves", description: "View leave requests and balance allocation" },
  "leave:manage": { name: "Manage Leaves", description: "Submit requests, allocate leaves, and approve/reject requests" },
  "payroll:read": { name: "Read Payroll", description: "View payroll salary structures and history slips" },
  "payroll:manage": { name: "Manage Payroll", description: "Configure salary components and execute payroll runs" },
  "performance:read": { name: "Read Performance", description: "View performance review assessments and objectives" },
  "performance:manage": { name: "Manage Performance", description: "Configure performance goals, reviews, and evaluations" },
};

async function seedRbac() {
  const [existingRole] = await db.select().from(roles).limit(1);

  if (existingRole) {
    console.log("Skipping roles/permissions — already seeded.");
    return;
  }

  const createdPermissions = await db
    .insert(permissions)
    .values(
      Object.values(PERMISSIONS).map((key) => ({
        key,
        name: PERMISSION_DISPLAY[key]?.name ?? key,
        description: PERMISSION_DISPLAY[key]?.description ?? null,
      })),
    )
    .returning();

  const permissionIdByKey = new Map(
    createdPermissions.map((p) => [p.key, p.id]),
  );

  for (const roleKey of Object.values(ROLES)) {
    const [role] = await db
      .insert(roles)
      .values({
        key: roleKey,
        name: ROLE_DISPLAY[roleKey] ?? roleKey,
      })
      .returning();

    const rolePerms = getRolePermissions(roleKey);

    if (rolePerms.length > 0) {
      await db.insert(rolePermissions).values(
        rolePerms.map((permissionKey) => ({
          roleId: role.id,
          permissionId: permissionIdByKey.get(permissionKey)!,
        })),
      );
    }
  }

  console.log("Seeded roles and permissions.");
}

async function ensureAuthUser(name: string, email: string) {
  const [existingAuthUser] = await db
    .select()
    .from(authUsers)
    .where(eq(authUsers.email, email))
    .limit(1);

  if (existingAuthUser) {
    return existingAuthUser.id;
  }

  const result = await auth.api.signUpEmail({
    body: {
      name,
      email,
      password: DEMO_PASSWORD,
    },
  });

  return result.user.id;
}

async function ensureAppUser(name: string, email: string) {
  const [existing] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existing) {
    return existing;
  }

  const [created] = await db
    .insert(users)
    .values({ name, email })
    .returning();

  return created;
}

async function seedTenant(seed: TenantSeed) {
  const [existingTenant] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.slug, seed.slug))
    .limit(1);

  if (existingTenant) {
    console.log(`Skipping "${seed.name}" core setup — already seeded.`);

    const existingEmployees = await db
      .select()
      .from(employees)
      .where(eq(employees.tenantId, existingTenant.id));

    const manager = existingEmployees.find((e) =>
      e.employeeCode.endsWith("-001"),
    );
    const employee = existingEmployees.find((e) =>
      e.employeeCode.endsWith("-002"),
    );

    if (manager && employee) {
      await seedSampleActivity(existingTenant.id, manager, employee);
    }

    return;
  }

  const [tenant] = await db
    .insert(tenants)
    .values({
      name: seed.name,
      slug: seed.slug,
      email: seed.email,
      city: seed.city,
      country: "India",
    })
    .returning();

  const appUserByRole = new Map<
    SeedUser["role"],
    { id: string; name: string; email: string }
  >();

  for (const seedUser of seed.users) {
    await ensureAuthUser(seedUser.name, seedUser.email);
    const appUser = await ensureAppUser(seedUser.name, seedUser.email);

    await db.insert(memberships).values({
      userId: appUser.id,
      tenantId: tenant.id,
      role: seedUser.role,
    });

    appUserByRole.set(seedUser.role, appUser);
  }

  const [engineering, sales] = await db
    .insert(departments)
    .values([
      { tenantId: tenant.id, name: "Engineering" },
      { tenantId: tenant.id, name: "Sales" },
    ])
    .returning();

  const [swEngineer] = await db
    .insert(designations)
    .values([
      { tenantId: tenant.id, name: "Software Engineer" },
      { tenantId: tenant.id, name: "Sales Executive" },
    ])
    .returning();

  const [headOffice] = await db
    .insert(locations)
    .values([
      {
        tenantId: tenant.id,
        name: "Head Office",
        city: seed.city,
        country: "India",
      },
    ])
    .returning();

  const managerUser = appUserByRole.get("manager")!;
  const employeeUser = appUserByRole.get("employee")!;

  const [managerEmployee] = await db
    .insert(employees)
    .values({
      tenantId: tenant.id,
      employeeCode: `${seed.slug.toUpperCase()}-001`,
      firstName: managerUser.name.split(" ")[0],
      lastName: managerUser.name.split(" ").slice(1).join(" ") || null,
      email: managerUser.email,
      dateOfJoining: new Date(),
      departmentId: engineering.id,
      designationId: swEngineer.id,
      locationId: headOffice.id,
      userId: managerUser.id,
      status: "active",
    })
    .returning();

  const [employeeEmployee] = await db
    .insert(employees)
    .values({
      tenantId: tenant.id,
      employeeCode: `${seed.slug.toUpperCase()}-002`,
      firstName: employeeUser.name.split(" ")[0],
      lastName: employeeUser.name.split(" ").slice(1).join(" ") || null,
      email: employeeUser.email,
      dateOfJoining: new Date(),
      departmentId: sales.id,
      designationId: swEngineer.id,
      locationId: headOffice.id,
      managerId: managerEmployee.id,
      userId: employeeUser.id,
      status: "active",
    })
    .returning();

  const createdLeaveTypes = await db
    .insert(leaveTypes)
    .values([
      {
        tenantId: tenant.id,
        name: "Casual Leave",
        daysPerYear: 12,
        maxConsecutiveDays: 3,
        minNoticeDays: 1,
        rulesText: "Casual leave cannot be taken for more than 3 consecutive days.",
      },
      {
        tenantId: tenant.id,
        name: "Sick Leave",
        daysPerYear: 8,
        rulesText: "Medical certificate required for sick leave beyond 2 consecutive days.",
      },
      {
        tenantId: tenant.id,
        name: "Earned Leave",
        daysPerYear: 15,
        carryForwardLimit: 30,
        minNoticeDays: 7,
        encashmentAllowed: true,
        rulesText: "Earned leave can be carried forward (up to 30 days) or encashed.",
      },
    ])
    .returning();

  const currentYear = new Date().getFullYear();

  for (const employeeRow of [managerEmployee, employeeEmployee]) {
    await db.insert(leaveBalances).values(
      createdLeaveTypes.map((leaveType) => ({
        tenantId: tenant.id,
        employeeId: employeeRow.id,
        leaveTypeId: leaveType.id,
        year: currentYear,
        allocatedDays: leaveType.daysPerYear,
        usedDays: 0,
        remainingDays: leaveType.daysPerYear,
      })),
    );
  }

  await db.insert(salaryStructures).values([
    {
      tenantId: tenant.id,
      employeeId: managerEmployee.id,
      basicSalary: "60000",
      effectiveFrom: new Date().toISOString().slice(0, 10),
      status: "active",
    },
    {
      tenantId: tenant.id,
      employeeId: employeeEmployee.id,
      basicSalary: "40000",
      effectiveFrom: new Date().toISOString().slice(0, 10),
      status: "active",
    },
  ]);

  await db.insert(salaryComponents).values([
    { tenantId: tenant.id, name: "HRA", type: "allowance", amount: "10000" },
    { tenantId: tenant.id, name: "Provident Fund", type: "deduction", amount: "3600" },
  ]);

  await seedSampleActivity(tenant.id, managerEmployee, employeeEmployee);

  console.log(`Seeded "${seed.name}" (${seed.slug}).`);
}

async function seedSampleActivity(
  tenantId: string,
  managerEmployee: { id: string },
  employeeEmployee: { id: string },
) {
  const [existingAttendance] = await db
    .select()
    .from(attendance)
    .where(eq(attendance.tenantId, tenantId))
    .limit(1);

  if (!existingAttendance) {
    const attendanceRows = [];
    for (let daysAgo = 1; daysAgo <= 5; daysAgo++) {
      const date = new Date();
      date.setDate(date.getDate() - daysAgo);
      const dateStr = date.toISOString().slice(0, 10);

      for (const emp of [managerEmployee, employeeEmployee]) {
        const checkIn = new Date(date);
        checkIn.setHours(9, Math.floor(Math.random() * 20), 0, 0);
        const checkOut = new Date(date);
        checkOut.setHours(18, Math.floor(Math.random() * 20), 0, 0);

        attendanceRows.push({
          tenantId,
          employeeId: emp.id,
          attendanceDate: dateStr,
          checkIn,
          checkOut,
          status: "present" as const,
        });
      }
    }
    await db.insert(attendance).values(attendanceRows);
    console.log("  Seeded sample attendance.");
  }

  const [existingLeaveRequest] = await db
    .select()
    .from(leaveRequests)
    .where(eq(leaveRequests.tenantId, tenantId))
    .limit(1);

  if (!existingLeaveRequest) {
    const [leaveType] = await db
      .select()
      .from(leaveTypes)
      .where(eq(leaveTypes.tenantId, tenantId))
      .limit(1);

    if (leaveType) {
      await db.insert(leaveRequests).values([
        {
          tenantId,
          employeeId: employeeEmployee.id,
          leaveTypeId: leaveType.id,
          startDate: "2026-11-10",
          endDate: "2026-11-11",
          totalDays: 2,
          reason: "Personal errand",
          status: "pending",
          managerId: managerEmployee.id,
        },
        {
          tenantId,
          employeeId: employeeEmployee.id,
          leaveTypeId: leaveType.id,
          startDate: "2026-08-03",
          endDate: "2026-08-03",
          totalDays: 1,
          reason: "Doctor visit",
          status: "approved",
          managerId: managerEmployee.id,
          managerComment: "Approved, feel better soon.",
        },
      ]);
      console.log("  Seeded sample leave requests.");
    }
  }

  const [existingRun] = await db
    .select()
    .from(payrollRuns)
    .where(eq(payrollRuns.tenantId, tenantId))
    .limit(1);

  if (!existingRun) {
    const period = new Date().toISOString().slice(0, 7); // YYYY-MM

    await createPayrollRecordWithRun({
      tenantId,
      employeeId: managerEmployee.id,
      payrollPeriod: period,
      basicSalary: "60000",
      totalAllowances: "10000",
      totalDeductions: "3600",
      netSalary: "66400",
    });

    await createPayrollRecordWithRun({
      tenantId,
      employeeId: employeeEmployee.id,
      payrollPeriod: period,
      basicSalary: "40000",
      totalAllowances: "10000",
      totalDeductions: "3600",
      netSalary: "46400",
    });
    console.log("  Seeded sample payroll run.");
  }

  const [existingGoal] = await db
    .select()
    .from(performanceGoals)
    .where(eq(performanceGoals.tenantId, tenantId))
    .limit(1);

  if (!existingGoal) {
    await db.insert(performanceGoals).values([
      {
        tenantId,
        employeeId: managerEmployee.id,
        title: "Improve team sprint velocity",
        description: "Reduce average sprint carry-over by 20%.",
        status: "active",
      },
      {
        tenantId,
        employeeId: employeeEmployee.id,
        title: "Complete onboarding certification",
        description: "Finish the internal product certification track.",
        status: "active",
      },
    ]);

    await db.insert(performanceReviews).values([
      {
        tenantId,
        employeeId: managerEmployee.id,
        reviewPeriod: "2026-H1",
        rating: 4,
        comments: "Strong leadership and delivery this half.",
        status: "completed",
      },
      {
        tenantId,
        employeeId: employeeEmployee.id,
        reviewPeriod: "2026-H1",
        rating: 3,
        comments: "Solid contributor, ramping up well.",
        status: "completed",
      },
    ]);
    console.log("  Seeded sample performance goals and reviews.");
  }
}

async function seedSuperAdmin() {
  await ensureAuthUser(SUPER_ADMIN.name, SUPER_ADMIN.email);
  const appUser = await ensureAppUser(SUPER_ADMIN.name, SUPER_ADMIN.email);

  if (!appUser.isSuperAdmin) {
    await db
      .update(users)
      .set({ isSuperAdmin: true })
      .where(eq(users.id, appUser.id));
  }

  console.log(`Seeded platform super admin (${SUPER_ADMIN.email}).`);
}

async function main() {
  await seedRbac();

  // `npm run db:seed:rbac` loads only the roles/permissions reference data
  // (safe for production); the full seed also creates demo accounts.
  if (process.argv.includes("--rbac-only")) {
    return;
  }

  for (const tenantSeed of TENANTS) {
    await seedTenant(tenantSeed);
  }

  await seedSuperAdmin();

  console.log("\nDemo login credentials (password for all: " + DEMO_PASSWORD + "):");

  for (const tenantSeed of TENANTS) {
    console.log(`\n${tenantSeed.name} (${tenantSeed.slug}):`);
    for (const seedUser of tenantSeed.users) {
      console.log(`  ${seedUser.role.padEnd(10)} ${seedUser.email}`);
    }
  }

  console.log(`\nPlatform Super Admin: ${SUPER_ADMIN.email}`);
}

main()
  .then(() => {
    console.log("\nSeed complete.");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  });
