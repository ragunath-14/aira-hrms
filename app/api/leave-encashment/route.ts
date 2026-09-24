import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { leaveEncashmentRequests, leaveTypes } from "@/db/schema";
import { requireRole } from "@/lib/authorization";

export async function GET(request: Request) {
  try {
    const auth = await requireRole(request, [
      "owner",
      "admin",
      "hr",
      "manager",
    ]);

    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");

    const conditions = [eq(leaveEncashmentRequests.tenantId, auth.tenant.id)];

    if (status) {
      conditions.push(eq(leaveEncashmentRequests.status, status));
    }

    const requests = await db
      .select({
        id: leaveEncashmentRequests.id,
        employeeId: leaveEncashmentRequests.employeeId,
        leaveTypeId: leaveEncashmentRequests.leaveTypeId,
        leaveType: leaveTypes.name,
        year: leaveEncashmentRequests.year,
        daysRequested: leaveEncashmentRequests.daysRequested,
        reason: leaveEncashmentRequests.reason,
        status: leaveEncashmentRequests.status,
        managerComment: leaveEncashmentRequests.managerComment,
        createdAt: leaveEncashmentRequests.createdAt,
      })
      .from(leaveEncashmentRequests)
      .innerJoin(leaveTypes, eq(leaveEncashmentRequests.leaveTypeId, leaveTypes.id))
      .where(and(...conditions));

    return NextResponse.json(requests);
  } catch (error) {
    console.error("GET admin leave encashment error:", error);

    return NextResponse.json(
      { error: "Failed to fetch leave encashment requests" },
      { status: 500 },
    );
  }
}
