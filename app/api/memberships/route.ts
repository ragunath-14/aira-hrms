import { and, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { memberships } from "@/db/schema/memberships";
import { users } from "@/db/schema/users";
import { requireRole } from "@/lib/auth/authorization";
import { ROLES, type Role } from "@/lib/auth/permissions";
import { canSetPasswordFor, setLoginPassword } from "@/lib/auth/credentials";
import { logAudit } from "@/lib/domain/audit";
import { checkCanAddPeople } from "@/lib/domain/plans";
import { membershipCreateSchema } from "@/lib/validation/schemas";

export async function GET(request: Request) {
  try {
    // The full team list (names, emails, roles) is only needed by user
    // management, so it is limited to the same roles that can manage users.
    const authResult = await requireRole(request, [
      "owner",
      "admin",
      "hr",
    ]);

    if (!authResult.authorized) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status },
      );
    }

    const tenantMembers = await db
      .select({
        id: memberships.id,
        userId: users.id,
        name: users.name,
        email: users.email,
        role: memberships.role,
        createdAt: memberships.createdAt,
        twoFactor: sql<boolean>`coalesce((select au.two_factor_enabled from "user" au where lower(au.email) = lower(${users.email}) limit 1), false)`,
      })
      .from(memberships)
      .innerJoin(users, eq(memberships.userId, users.id))
      .where(eq(memberships.tenantId, authResult.tenant.id));

    return NextResponse.json(tenantMembers);
  } catch (error) {
    console.error("Memberships GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch memberships" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const authResult = await requireRole(request, [
      "owner",
      "admin",
      "hr",
    ]);

    if (!authResult.authorized) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status },
      );
    }

    const body = await request.json();

    const parsed = membershipCreateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const email = parsed.data.email?.trim();
    const name = parsed.data.name?.trim();
    const role = parsed.data.role as Role;
    let userId = parsed.data.userId;

    const allowedRoles: Role[] = [
      ROLES.HR,
      ROLES.MANAGER,
      ROLES.EMPLOYEE,
      ROLES.ADMIN,
      ROLES.MEMBER,
    ];

    if (!allowedRoles.includes(role)) {
      return NextResponse.json(
        { error: "Invalid role" },
        { status: 400 },
      );
    }

    if (
      parsed.data.password &&
      (!email || !canSetPasswordFor(authResult.role, role))
    ) {
      return NextResponse.json(
        { error: "You cannot set a password for this role" },
        { status: 403 },
      );
    }

    const planProblem = await checkCanAddPeople(authResult.tenant);

    if (planProblem) {
      return NextResponse.json({ error: planProblem }, { status: 402 });
    }

    let user;

    if (email) {
      // Find or create user by email
      const [existingUser] = await db
        .select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      if (existingUser) {
        user = existingUser;
        userId = existingUser.id;
      } else {
        const [newUser] = await db
          .insert(users)
          .values({
            name: name || email.split("@")[0],
            email,
          })
          .returning();
        user = newUser;
        userId = newUser.id;
      }
    } else if (userId) {
      const [existingUser] = await db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!existingUser) {
        return NextResponse.json(
          { error: "User not found" },
          { status: 404 },
        );
      }
      user = existingUser;
    } else {
      return NextResponse.json(
        { error: "userId or email is required" },
        { status: 400 },
      );
    }

    const existingMembership = await db
      .select()
      .from(memberships)
      .where(
        and(
          eq(memberships.userId, userId),
          eq(memberships.tenantId, authResult.tenant.id),
        ),
      )
      .limit(1);

    if (existingMembership.length > 0) {
      return NextResponse.json(
        { error: "User is already a member of this tenant" },
        { status: 409 },
      );
    }

    const [membership] = await db
      .insert(memberships)
      .values({
        userId,
        tenantId: authResult.tenant.id,
        role,
      })
      .returning();

    await logAudit({
      tenantId: authResult.tenant.id,
      userId: authResult.user.id,
      action: "role_changed",
      entity: "membership",
      entityId: membership.id,
    });

    if (parsed.data.password && email) {
      await setLoginPassword({
        email: user.email,
        name: user.name,
        password: parsed.data.password,
      });

      await logAudit({
        tenantId: authResult.tenant.id,
        userId: authResult.user.id,
        action: "login_created",
        entity: "membership",
        entityId: membership.id,
      });
    }

    return NextResponse.json(
      { membership, user },
      { status: 201 },
    );
  } catch (error) {
    console.error("Membership creation error:", error);

    return NextResponse.json(
      { error: "Failed to create membership" },
      { status: 500 },
    );
  }
}