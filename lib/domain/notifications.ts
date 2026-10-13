import { eq } from "drizzle-orm";

import { db } from "@/db";
import { notifications } from "@/db/schema/notifications";
import { tenants } from "@/db/schema/tenants";
import { users } from "@/db/schema/users";
import { resolveSettings } from "@/lib/config/settings";
import { appUrl, emailConfigured, sendEmail } from "@/lib/email/mailer";
import { notificationEmail } from "@/lib/email/templates";

// Which notifications are also sent by email, and where the email's button
// goes. "leave" and "payroll" follow the company's notification settings
// (Settings -> System); "always" ones are time-sensitive or security related.
const EMAILED: Record<string, { gate: "leave" | "payroll" | "always"; path?: string }> = {
  leave_approved: { gate: "leave", path: "/employee/leave" },
  leave_rejected: { gate: "leave", path: "/employee/leave" },
  leave_submitted: { gate: "leave", path: "/leave" },
  payroll_generated: { gate: "payroll", path: "/employee/payslips" },
  meeting_invite: { gate: "always" },
  meeting_call: { gate: "always" },
  meeting_cancelled: { gate: "always" },
  password_changed: { gate: "always" },
  two_factor_reset: { gate: "always" },
};

async function emailNotification(params: {
  tenantId: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  link?: string;
}) {
  const rule = EMAILED[params.type];
  if (!rule || !emailConfigured()) return;

  try {
    const [[user], [tenant]] = await Promise.all([
      db.select({ name: users.name, email: users.email }).from(users).where(eq(users.id, params.userId)).limit(1),
      db.select({ settings: tenants.settings }).from(tenants).where(eq(tenants.id, params.tenantId)).limit(1),
    ]);

    if (!user) return;

    const settings = resolveSettings(tenant?.settings);
    if (rule.gate === "leave" && !settings.notifyLeave) return;
    if (rule.gate === "payroll" && !settings.notifyPayroll) return;

    const email = notificationEmail({
      name: user.name,
      title: params.title,
      message: params.message,
      link: params.link ?? (rule.path ? `${appUrl()}${rule.path}` : null),
    });

    await sendEmail({ to: user.email, ...email });
  } catch (error) {
    console.error("[email] notification email failed:", error instanceof Error ? error.message : error);
  }
}

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

  // Email copy: runs in the background so a slow mail server never delays the
  // request, and a failure never breaks the action that created it.
  void emailNotification(params);
}
