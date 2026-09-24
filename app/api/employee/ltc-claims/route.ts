import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { employees, ltcClaims, notifications } from "@/db/schema";
import { getCurrentTenant } from "@/lib/authorization";
import { ltcClaimCreateSchema } from "@/lib/validations";

export async function GET(request: Request) {
  try {
    const context = await getCurrentTenant(request);

    if (!context) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { user, tenant } = context;

    const [employee] = await db
      .select({ id: employees.id })
      .from(employees)
      .where(and(eq(employees.userId, user.id), eq(employees.tenantId, tenant.id)))
      .limit(1);

    if (!employee) {
      return NextResponse.json(
        { error: "Employee record not found" },
        { status: 404 },
      );
    }

    const claims = await db
      .select()
      .from(ltcClaims)
      .where(and(eq(ltcClaims.employeeId, employee.id), eq(ltcClaims.tenantId, tenant.id)))
      .orderBy(desc(ltcClaims.createdAt));

    return NextResponse.json(claims);
  } catch (error) {
    console.error("GET LTC claims error:", error);

    return NextResponse.json(
      { error: "Failed to fetch LTC claims" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const context = await getCurrentTenant(request);

    if (!context) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { user, tenant } = context;

    const [employee] = await db
      .select()
      .from(employees)
      .where(and(eq(employees.userId, user.id), eq(employees.tenantId, tenant.id)))
      .limit(1);

    if (!employee) {
      return NextResponse.json(
        { error: "Employee record not found" },
        { status: 404 },
      );
    }

    const body = await request.json();
    const parsed = ltcClaimCreateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const {
      blockYear,
      travelStartDate,
      travelEndDate,
      destination,
      amountClaimed,
      proofUrl,
      reason,
    } = parsed.data;

    const [created] = await db
      .insert(ltcClaims)
      .values({
        tenantId: tenant.id,
        employeeId: employee.id,
        blockYear,
        travelStartDate: travelStartDate || null,
        travelEndDate: travelEndDate || null,
        destination: destination ?? null,
        amountClaimed: String(amountClaimed),
        proofUrl: proofUrl ?? null,
        reason: reason ?? null,
        status: "pending",
        managerId: employee.managerId ?? null,
      })
      .returning();

    if (employee.managerId) {
      const [manager] = await db
        .select({ userId: employees.userId })
        .from(employees)
        .where(and(eq(employees.id, employee.managerId), eq(employees.tenantId, tenant.id)))
        .limit(1);

      if (manager?.userId) {
        await db.insert(notifications).values({
          tenantId: tenant.id,
          userId: manager.userId,
          type: "ltc_claim_submitted",
          title: "New LTC Claim",
          message: `${employee.firstName} ${employee.lastName ?? ""} submitted an LTC claim of ₹${amountClaimed} for block year ${blockYear}.`,
          isRead: false,
        });
      }
    }

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error("POST LTC claim error:", error);

    return NextResponse.json(
      { error: "Failed to create LTC claim" },
      { status: 500 },
    );
  }
}
