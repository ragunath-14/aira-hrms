import { db } from "@/db";
import { notifications } from "@/db/schema/notifications";

export async function createNotification(params: {
  tenantId: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  link?: string;
}) {
  await db.insert(notifications).values({
    tenantId: params.tenantId,
    userId: params.userId,
    type: params.type,
    title: params.title,
    message: params.message,
    link: params.link ?? null,
    isRead: false,
  });
}
