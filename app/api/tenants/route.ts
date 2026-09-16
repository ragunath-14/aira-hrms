import { eq } from "drizzle-orm";

import { db } from "@/db";
import { memberships } from "@/db/schema/memberships";
import { tenants } from "@/db/schema/tenants";
import { users } from "@/db/schema/users";
import { auth } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    // 1. Get authenticated session
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return Response.json(
        {
          error: "Unauthorized",
        },
        {
          status: 401,
        },
      );
    }

    // 2. Find application user
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, session.user.email))
      .limit(1);

    if (!user) {
      return Response.json(
        {
          error: "User not found",
        },
        {
          status: 404,
        },
      );
    }

    // 3. Read only tenant information from browser
    const body = await request.json();

    const name = body.name?.trim();
    const slug = body.slug?.trim();

    if (!name || !slug) {
      return Response.json(
        {
          error: "Name and slug are required",
        },
        {
          status: 400,
        },
      );
    }

    // 4. Check duplicate tenant slug
    const [existingTenant] = await db
      .select()
      .from(tenants)
      .where(eq(tenants.slug, slug))
      .limit(1);

    if (existingTenant) {
      return Response.json(
        {
          error: "Tenant with this slug already exists",
        },
        {
          status: 409,
        },
      );
    }

    // 5. Create tenant
    const [tenant] = await db
      .insert(tenants)
      .values({
        name,
        slug,
      })
      .returning();

    // 6. Automatically make the creator the owner
    const [membership] = await db
      .insert(memberships)
      .values({
        userId: user.id,
        tenantId: tenant.id,
        role: "owner",
      })
      .returning();

    return Response.json(
      {
        tenant,
        membership,
      },
      {
        status: 201,
      },
    );
  } catch (error) {
    console.error("Tenant creation error:", error);

    return Response.json(
      {
        error: "Failed to create tenant",
      },
      {
        status: 500,
      },
    );
  }
}