import { eq } from "drizzle-orm";

import { db } from "./index";
import { auth } from "../lib/auth";
import { user as authUsers } from "./schema/auth";
import { users } from "./schema/users";
import { tenants } from "./schema/tenants";
import { memberships } from "./schema/memberships";
import { departments, designations, locations } from "./schema/organization";
import { employees } from "./schema/employees";
import { leaveTypes, leaveBalances } from "./schema/leaves";
import { salaryStructures, salaryComponents } from "./schema/payroll";

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
    console.log(`Skipping "${seed.name}" — already seeded.`);
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
      { tenantId: tenant.id, name: "Casual Leave", daysPerYear: 12 },
      { tenantId: tenant.id, name: "Sick Leave", daysPerYear: 8 },
      { tenantId: tenant.id, name: "Earned Leave", daysPerYear: 15 },
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

  console.log(`Seeded "${seed.name}" (${seed.slug}).`);
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
