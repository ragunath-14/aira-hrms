import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";

import { db } from "@/db";
import {
  employees,
  leaveBalances,
  leaveTypes,
} from "@/db/schema";
import { getCurrentTenant } from "@/lib/authorization";

export async function GET(request: Request) {
  try {
    const context = await getCurrentTenant(request);

    if (!context) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 },
      );
    }

    const { user, tenant } = context;

    const [employee] = await db
      .select()
      .from(employees)
      .where(
        and(
          eq(employees.userId, user.id),
          eq(employees.tenantId, tenant.id),
        ),
      )
      .limit(1);

    if (!employee) {
      return NextResponse.json(
        { error: "Employee record not found" },
        { status: 404 },
      );
    }

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
