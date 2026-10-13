import { db } from "@/db";
import { auditLogs } from "@/db/schema/audit-logs";

export async function logAudit(params: {
  tenantId: string;
  userId: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
}) {
  await db.insert(auditLogs).values({
    tenantId: params.tenantId,
    userId: params.userId,
    action: params.action,
    entity: params.entity,
    entityId: params.entityId ?? null,
  });
}
