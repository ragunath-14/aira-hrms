import { and, asc, desc, eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import { customRoles, departments, jobOpenings, memberships } from "@/db/schema";
import { createNotification } from "@/lib/domain/notifications";

// The openings a company has published and not closed: the only jobs the
// outside world ever sees. Optionally one job by id.
export async function listPublishedJobs(tenantId: string, jobId?: string) {
  return db
    .select({
      id: jobOpenings.id,
      title: jobOpenings.title,
      location: jobOpenings.location,
      employmentType: jobOpenings.employmentType,
      openings: jobOpenings.openings,
      description: jobOpenings.description,
      postedAt: jobOpenings.createdAt,
      department: departments.name,
    })
    .from(jobOpenings)
    .leftJoin(departments, eq(departments.id, jobOpenings.departmentId))
    .where(
      and(
        eq(jobOpenings.tenantId, tenantId),
        eq(jobOpenings.published, true),
        eq(jobOpenings.status, "open"),
        ...(jobId ? [eq(jobOpenings.id, jobId)] : []),
      ),
    )
    .orderBy(desc(jobOpenings.createdAt), asc(jobOpenings.title));
}

// Tells the people who review applications that a new one arrived: owners,
// admins and HR, except anyone whose company role has no access to recruitment.
export async function notifyRecruiters(params: {
  tenantId: string;
  candidateName: string;
  jobTitle: string;
}) {
  const rows = await db
    .select({
      userId: memberships.userId,
      permissions: customRoles.permissions,
      customRoleId: memberships.customRoleId,
    })
    .from(memberships)
    .leftJoin(customRoles, eq(customRoles.id, memberships.customRoleId))
    .where(
      and(
        eq(memberships.tenantId, params.tenantId),
        inArray(memberships.role, ["owner", "admin", "hr"]),
      ),
    );

  const recipients = rows
    .filter(
      (r) =>
        !r.customRoleId ||
        (r.permissions as Record<string, string[]> | null)?.recruitment?.includes("view"),
    )
    .slice(0, 10);

  await Promise.all(
    recipients.map((r) =>
      createNotification({
        tenantId: params.tenantId,
        userId: r.userId,
        type: "new_application",
        title: "New job application",
        message: `${params.candidateName} applied for ${params.jobTitle} from the careers page.`,
        link: "/recruitment",
      }).catch(() => {}),
    ),
  );
}
