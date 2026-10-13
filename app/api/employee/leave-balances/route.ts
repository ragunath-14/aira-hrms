import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";

import { db } from "@/db";
import {
  employees,
  leaveBalances,
  leaveTypes,
} from "@/db/schema";
import { getOrCreateCurrentEmployee } from "@/lib/auth/authorization";

export async function GET(request: Request) {
  try {
    const auth = await getOrCreateCurrentEmployee(request);

    if (!auth) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 },
      );
    }

    const { employee, tenant } = auth;

    const balances = await db
      .select({
        id: leaveBalances.id,
        leaveTypeId: leaveBalances.leaveTypeId,
        leaveType: leaveTypes.name,
        year: leaveBalances.year,
        allocatedDays: leaveBalances.allocatedDays,
        usedDays: leaveBalances.usedDays,
        remainingDays: leaveBalances.remainingDays,
      })
      .from(leaveBalances)
      .leftJoin(
        leaveTypes,
        eq(leaveBalances.leaveTypeId, leaveTypes.id),
      )
      .where(
        and(
          eq(leaveBalances.employeeId, employee.id),
          eq(leaveBalances.tenantId, tenant.id),
        ),
      )
      .orderBy(desc(leaveBalances.year));

    return NextResponse.json(balances);
  } catch (error) {
    console.error(
      "GET employee leave balances error:",
      error,
    );

    return NextResponse.json(
      { error: "Failed to fetch employee leave balances" },
      { status: 500 },
    );
  }
}
