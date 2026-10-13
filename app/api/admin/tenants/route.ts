import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { tenants } from "@/db/schema/tenants";
import { memberships } from "@/db/schema/memberships";
import { users } from "@/db/schema/users";
import { z } from "zod";

import { logAudit } from "@/lib/domain/audit";
import { requireSuperAdmin } from "@/lib/auth/authorization";
import { auth as authInstance } from "@/lib/auth/server";
import { setLoginPassword } from "@/lib/auth/credentials";
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
  password: z.string().min(12).max(128),

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

    // An email that already has a login could belong to another company.
    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, ownerEmail))
      .limit(1);

    const authCtx = await auth$context();
    const existingLogin = await authCtx.internalAdapter.findUserByEmail(ownerEmail);

    if (existing || existingLogin) {
      return NextResponse.json(
        { error: "A user with this email already exists" },
        { status: 409 },
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
        accessStatus: "approved",
        accessReviewedAt: new Date(),
        accessReviewedBy: auth.user.id,
      })
      .returning();

    const [owner] = await db
      .insert(users)
      .values({ name: ownerName, email: ownerEmail })
      .returning();

    await db.insert(memberships).values({
      userId: owner.id,
      tenantId: tenant.id,
      role: "owner",
    });

    try {
      await setLoginPassword({ email: ownerEmail, name: ownerName, password });
    } catch (loginError) {
      // Do not leave a company without a way to sign in.
      await db.delete(tenants).where(eq(tenants.id, tenant.id));
      await db.delete(users).where(eq(users.id, owner.id));
      throw loginError;
    }

    await logAudit({
      tenantId: tenant.id,
      userId: auth.user.id,
      action: "company_created",
      entity: "tenant",
      entityId: tenant.id,
    });

    return NextResponse.json(
      { id: tenant.id, companyName: tenant.name, ownerEmail },
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
