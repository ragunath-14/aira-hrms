import { NextResponse } from "next/server";
import { and, desc, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { tenants } from "@/db/schema/tenants";
import { memberships } from "@/db/schema/memberships";
import { users } from "@/db/schema/users";
import { z } from "zod";

import { logAudit } from "@/lib/domain/audit";
import { requireSuperAdmin } from "@/lib/auth/authorization";
import { auth as authInstance } from "@/lib/auth/server";
import { setLoginPassword } from "@/lib/auth/credentials";
import { DEFAULT_PLAN, PLAN_IDS } from "@/lib/config/plans";
import { httpUrl } from "@/lib/validation/schemas";

const auth$context = () => authInstance.$context;

// Companies for the platform owner. This deliberately returns only the
// account details needed to manage access (company name, owner, when created,
// status) and never any of the company's own data (employees, payroll, ...).
export async function GET(request: Request) {
  try {
    const auth = await requireSuperAdmin(request);

    if (!auth.authorized) {
      return NextResponse.json(
        { error: auth.error },
        { status: auth.status },
      );
    }

    const rows = await db
      .select({
        id: tenants.id,
        companyName: tenants.name,
        status: tenants.accessStatus,
        requestedAt: tenants.createdAt,
        reviewedAt: tenants.accessReviewedAt,
        note: tenants.accessNote,
        ownerName: users.name,
        ownerEmail: users.email,
        ownerTwoFactor: sql<boolean>`coalesce((select au.two_factor_enabled from "user" au where lower(au.email) = lower(${users.email}) limit 1), false)`,
        plan: tenants.plan,
        planEmployeeLimit: tenants.planEmployeeLimit,
        planStorageMb: tenants.planStorageMb,
        planExpiresAt: tenants.planExpiresAt,
        // Counts only (never the data itself) so the platform owner can see
        // how much of its plan each company is using.
        peopleUsed: sql<number>`greatest(
          (select count(*)::int from employees e where e.tenant_id = ${tenants.id} and e.status <> 'terminated'),
          (select count(*)::int from memberships m where m.tenant_id = ${tenants.id})
        )`,
        storageUsedBytes: sql<number>`coalesce((select sum(d.size_bytes) from employee_documents d where d.tenant_id = ${tenants.id} and d.kind = 'file'), 0)::float8`,
        phone: tenants.phone,
        city: tenants.city,
        state: tenants.state,
        country: tenants.country,
      })
      .from(tenants)
      .leftJoin(
        memberships,
        and(
          eq(memberships.tenantId, tenants.id),
          eq(memberships.role, "owner"),
        ),
      )
      .leftJoin(users, eq(users.id, memberships.userId))
      .orderBy(desc(tenants.createdAt));

    // A company with several owners would repeat; keep the first row each.
    const seen = new Set<string>();
    const result = rows.filter((row) => {
      if (seen.has(row.id)) return false;
      seen.add(row.id);
      return true;
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("GET access requests error:", error);

    return NextResponse.json(
      { error: "Failed to fetch access requests" },
      { status: 500 },
    );
  }
}


// Optional text: blank means "not given".
const optionalText = (max: number) =>
  z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().trim().max(max).optional(),
  );

const createSchema = z.object({
  companyName: z.string().trim().min(2).max(120),
  ownerName: z.string().trim().min(2).max(120),
  ownerEmail: z.string().trim().toLowerCase().email().max(200),
  // Needed for a brand-new login. Leave it out when the owner's email already
  // has a login (for example they own another company): that same login then
  // becomes the owner of this company and its password is not touched.
  password: z.string().min(12).max(128).optional(),

  // Subscription plan the company starts on; changeable later.
  plan: z.enum(PLAN_IDS as [string, ...string[]]).default(DEFAULT_PLAN),

  // Company details the platform owner notes down for the company; the owner
  // sees them pre-filled in Settings -> Company and can edit them.
  companyEmail: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().trim().toLowerCase().email().max(200).optional(),
  ),
  phone: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z
      .string()
      .trim()
      .regex(/^\+?[0-9][0-9 ()-]{6,19}$/, "Phone must be 7 to 20 digits")
      .optional(),
  ),
  website: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    httpUrl.optional(),
  ),
  address: optionalText(300),
  city: optionalText(80),
  state: optionalText(80),
  country: optionalText(80),
});

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "company";

// Create a company and its owner login. The platform owner chooses the owner's
// email (the user ID) and password and hands them over; the owner then creates
// their own team from Settings -> Users. The password is stored only hashed.
export async function POST(request: Request) {
  try {
    const auth = await requireSuperAdmin(request);

    if (!auth.authorized) {
      return NextResponse.json(
        { error: auth.error },
        { status: auth.status },
      );
    }

    const parsed = createSchema.safeParse(await request.json());

    if (!parsed.success) {
      return NextResponse.json(
        {
          error:
            parsed.error.issues[0]?.message &&
            !/^(Invalid|Too|String)/.test(parsed.error.issues[0].message)
              ? parsed.error.issues[0].message
              : "Enter a company name, owner name, a valid owner email and a password of 12 to 128 characters",
        },
        { status: 400 },
      );
    }

    const { companyName, ownerName, ownerEmail, password, ...details } = parsed.data;

    // An email that already has a login may belong to another company. That is
    // allowed (one login, several companies), but then its password is never set
    // here: the person keeps signing in with their own.
    const [existing] = await db
      .select()
      .from(users)
      .where(eq(users.email, ownerEmail))
      .limit(1);

    const authCtx = await auth$context();
    const existingLogin = await authCtx.internalAdapter.findUserByEmail(ownerEmail);
    const hasAccount = Boolean(existing || existingLogin);

    if (existing?.isSuperAdmin) {
      return NextResponse.json(
        { error: "A platform administrator cannot also own a company" },
        { status: 409 },
      );
    }

    if (hasAccount && password) {
      return NextResponse.json(
        {
          error:
            "This email already has a login. Leave the password empty to make that same login the owner of this company (its password stays as it is).",
        },
        { status: 409 },
      );
    }

    if (!hasAccount && !password) {
      return NextResponse.json(
        { error: "Enter a password of 12 to 128 characters for the new login" },
        { status: 400 },
      );
    }

    const [tenant] = await db
      .insert(tenants)
      .values({
        name: companyName,
        slug: `${slugify(companyName)}-${crypto.randomUUID().slice(0, 6)}`,
        email: details.companyEmail ?? ownerEmail,
        phone: details.phone ?? null,
        website: details.website || null,
        address: details.address ?? null,
        city: details.city ?? null,
        state: details.state ?? null,
        country: details.country ?? null,
        plan: details.plan,
        accessStatus: "approved",
        accessReviewedAt: new Date(),
        accessReviewedBy: auth.user.id,
      })
      .returning();

    const owner =
      existing ??
      (
        await db
          .insert(users)
          .values({ name: existingLogin?.user.name ?? ownerName, email: ownerEmail })
          .returning()
      )[0];

    await db.insert(memberships).values({
      userId: owner.id,
      tenantId: tenant.id,
      role: "owner",
    });

    if (!hasAccount && password) {
      try {
        await setLoginPassword({ email: ownerEmail, name: ownerName, password });
      } catch (loginError) {
        // Do not leave a company without a way to sign in.
        await db.delete(tenants).where(eq(tenants.id, tenant.id));
        await db.delete(users).where(eq(users.id, owner.id));
        throw loginError;
      }
    }

    await logAudit({
      tenantId: tenant.id,
      userId: auth.user.id,
      action: "company_created",
      entity: "tenant",
      entityId: tenant.id,
    });

    return NextResponse.json(
      { id: tenant.id, companyName: tenant.name, ownerEmail, existingLogin: hasAccount },
      { status: 201 },
    );
  } catch (error) {
    console.error("POST company error:", error);

    return NextResponse.json(
      { error: "Failed to create company" },
      { status: 500 },
    );
  }
}
