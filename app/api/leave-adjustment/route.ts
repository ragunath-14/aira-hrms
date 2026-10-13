import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { leaveAdjustmentRequests, leaveTypes } from "@/db/schema";
import { requireRole } from "@/lib/auth/authorization";

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

    const conditions = [eq(leaveAdjustmentRequests.tenantId, auth.tenant.id)];

    if (status) {
      conditions.push(eq(leaveAdjustmentRequests.status, status));
    }

    const requests = await db
      .select({
        id: leaveAdjustmentRequests.id,
        employeeId: leaveAdjustmentRequests.employeeId,
        leaveTypeId: leaveAdjustmentRequests.leaveTypeId,
        leaveType: leaveTypes.name,
        year: leaveAdjustmentRequests.year,
        requestedDays: leaveAdjustmentRequests.requestedDays,
        reason: leaveAdjustmentRequests.reason,
        status: leaveAdjustmentRequests.status,
        managerComment: leaveAdjustmentRequests.managerComment,
        createdAt: leaveAdjustmentRequests.createdAt,
      })
      .from(leaveAdjustmentRequests)
      .innerJoin(leaveTypes, eq(leaveAdjustmentRequests.leaveTypeId, leaveTypes.id))
      .where(and(...conditions));

    return NextResponse.json(requests);
  } catch (error) {
    console.error("GET admin leave adjustment error:", error);

    return NextResponse.json(
      { error: "Failed to fetch leave adjustment requests" },
      { status: 500 },
    );
  }
}
