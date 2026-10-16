import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { users } from "@/db/schema/users";
import { ACTIVE_TENANT_COOKIE, getActiveMembership, validTenantId } from "@/lib/auth/active-tenant";
import { auth } from "@/lib/auth/server";

// Server-side page guard: a signed-in user whose company the platform owner
// has not approved is sent to the waiting page instead of the portal. (The
// APIs enforce the same rule independently in getCurrentTenant.)
export async function requireApprovedCompany() {
  const session = await auth.api.getSession({ headers: await headers() });

  // Signed-out visitors are handled by the proxy.
  if (!session) return;

  const [person] = await db
    .select({ id: users.id, isSuperAdmin: users.isSuperAdmin })
    .from(users)
    .where(eq(users.email, session.user.email))
    .limit(1);

  if (!person) return;

  // The company they are working in: their choice if it is one of theirs and
  // approved, otherwise their first approved one.
  const active = await getActiveMembership(
    person.id,
    validTenantId((await cookies()).get(ACTIVE_TENANT_COOKIE)?.value),
  );

  if (!active || active.accessStatus === "approved") return;

  redirect(person.isSuperAdmin ? "/admin" : "/pending-approval");
}
