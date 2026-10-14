import { and, eq, ne, sql } from "drizzle-orm";

import { db } from "@/db";
import { employeeDocuments, employees, memberships } from "@/db/schema";
import { resolveLimits, type PlanFields } from "@/lib/config/plans";
import { formatDate } from "@/lib/format/date";

// How much a company is using: people (the larger of its employee records and
// its logins, so neither route past the limit) and stored document bytes.
export async function getUsage(tenantId: string) {
  const [[people], [logins], [storage]] = await Promise.all([
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(employees)
      .where(and(eq(employees.tenantId, tenantId), ne(employees.status, "terminated"))),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(memberships)
      .where(eq(memberships.tenantId, tenantId)),
    db
      .select({ bytes: sql<number>`coalesce(sum(${employeeDocuments.sizeBytes}), 0)::float8` })
      .from(employeeDocuments)
      .where(and(eq(employeeDocuments.tenantId, tenantId), eq(employeeDocuments.kind, "file"))),
  ]);

  return {
    people: Math.max(people?.n ?? 0, logins?.n ?? 0),
    storageBytes: Number(storage?.bytes ?? 0),
  };
}

const expiredMessage = (expiresAt: Date) =>
  `This company's plan expired on ${formatDate(expiresAt)}. Contact the platform administrator to renew it.`;

// Null when one more person can be added; otherwise the reason they cannot.
export async function checkCanAddPeople(tenant: PlanFields & { id: string }, adding = 1) {
  const limits = resolveLimits(tenant);

  if (limits.expired && limits.expiresAt) return expiredMessage(limits.expiresAt);
  if (limits.employeeLimit === null) return null;

  const { people } = await getUsage(tenant.id);

  if (people + adding > limits.employeeLimit) {
    return `Your ${limits.plan.label} plan allows ${limits.employeeLimit} people and you already have ${people}. Ask the platform administrator to upgrade your plan.`;
  }

  return null;
}

// Null when a file of this size fits; otherwise the reason it does not.
export async function checkCanStore(tenant: PlanFields & { id: string }, incomingBytes: number) {
  const limits = resolveLimits(tenant);

  if (limits.expired && limits.expiresAt) return expiredMessage(limits.expiresAt);

  const { storageBytes } = await getUsage(tenant.id);

  if (storageBytes + incomingBytes > limits.storageBytes) {
    const mb = Math.round(limits.storageBytes / (1024 * 1024));
    return `Document storage is full (${mb} MB on the ${limits.plan.label} plan). Delete old documents or ask the platform administrator to upgrade your plan.`;
  }

  return null;
}
