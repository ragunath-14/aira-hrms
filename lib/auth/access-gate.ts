import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { memberships } from "@/db/schema/memberships";
import { tenants } from "@/db/schema/tenants";
import { users } from "@/db/schema/users";
import { auth } from "@/lib/auth/server";

// Server-side page guard: a signed-in user whose company the platform owner
// has not approved is sent to the waiting page instead of the portal. (The
// APIs enforce the same rule independently in getCurrentTenant.)
export async function requireApprovedCompany() {
  const session = await auth.api.getSession({ headers: await headers() });

  // Signed-out visitors are handled by the proxy.
  if (!session) return;

  const [row] = await db
    .select({
      isSuperAdmin: users.isSuperAdmin,
      accessStatus: tenants.accessStatus,
    })
    .from(users)
    .leftJoin(memberships, eq(memberships.userId, users.id))
    .leftJoin(tenants, eq(tenants.id, memberships.tenantId))
    .where(eq(users.email, session.user.email))
    .limit(1);

  if (!row || !row.accessStatus || row.accessStatus === "approved") return;

  redirect(row.isSuperAdmin ? "/admin" : "/pending-approval");
}
