import { asc, eq } from "drizzle-orm";

import { db } from "@/db";
import { memberships } from "@/db/schema/memberships";
import { tenants } from "@/db/schema/tenants";

// One login can belong to several companies. Which one a request is for is the
// person's choice, remembered in this cookie. The cookie is only a preference:
// it is checked against the person's real memberships on every request, so
// putting someone else's company id in it gets them nothing.
export const ACTIVE_TENANT_COOKIE = "aira_tenant";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// A cookie value as a company id, or null when it is missing or malformed.
export function validTenantId(value: string | null | undefined) {
  return value && UUID.test(value) ? value.toLowerCase() : null;
}

// The company the person last chose, from a Cookie header (or null).
export function readActiveTenantId(cookieHeader: string | null | undefined) {
  if (!cookieHeader) return null;

  for (const part of cookieHeader.split(";")) {
    const [name, ...rest] = part.trim().split("=");

    if (name === ACTIVE_TENANT_COOKIE) return validTenantId(decodeURIComponent(rest.join("=")));
  }

  return null;
}

// Picks the membership to act in: the chosen company when it is one of theirs
// and approved; otherwise their first approved company; otherwise (all still
// waiting for approval) their first, so they land on the waiting page.
export function chooseMembership<T extends { tenantId: string; accessStatus: string }>(
  rows: T[],
  preferred: string | null,
): T | null {
  if (rows.length === 0) return null;

  const approved = rows.filter((row) => row.accessStatus === "approved");
  const wanted = preferred ? approved.find((row) => row.tenantId === preferred) : undefined;

  return wanted ?? approved[0] ?? rows[0];
}

// Every company a user belongs to, oldest membership first.
export async function listMemberships(userId: string) {
  return db
    .select({
      membershipId: memberships.id,
      tenantId: memberships.tenantId,
      role: memberships.role,
      joinedAt: memberships.createdAt,
      name: tenants.name,
      slug: tenants.slug,
      accessStatus: tenants.accessStatus,
    })
    .from(memberships)
    .innerJoin(tenants, eq(tenants.id, memberships.tenantId))
    .where(eq(memberships.userId, userId))
    .orderBy(asc(memberships.createdAt), asc(memberships.id));
}

// The membership a user is acting in right now.
export async function getActiveMembership(userId: string, preferred: string | null) {
  return chooseMembership(await listMemberships(userId), preferred);
}
