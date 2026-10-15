import { eq, and } from "drizzle-orm";
import {
  getCurrentTenant,
  requireRole,
} from "@/lib/auth/authorization";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { leaveTypes } from "@/db/schema/leaves";
import { requirePermission } from "@/lib/auth/authorization";
import { type Permission } from "@/lib/auth/permissions";

const LEAVE_MANAGE_PERMISSION =
  "leave:manage" as Permission;

const LEAVE_READ_PERMISSION =
  "leave:read" as Permission;

export async function GET(request: Request) {
  try {
    const authResult = await requirePermission(
      request,
      LEAVE_READ_PERMISSION,
    );

    if (!authResult.authorized) {
      return Response.json(
        { error: authResult.error },
        { status: authResult.status },
      );
    }
const auth = await requireRole(request, [
  "owner",
  "admin",
  "hr",
  "manager",
  "employee",
]);

if (!auth.authorized) {
  return NextResponse.json(
    { error: auth.error },
    { status: auth.status },
  );
}
    // GET intentionally stays open to every role — employees need to
    // see which leave types exist in order to apply for leave.
    const rows = await db
      .select()
      .from(leaveTypes)
      .where(
        eq(
          leaveTypes.tenantId,
          authResult.tenant.id,
        ),
      );

    return Response.json(rows);
  } catch (error) {
    console.error("Leave types GET error:", error);

    return Response.json(
      { error: "Failed to fetch leave types" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const authResult = await requirePermission(
      request,
      LEAVE_MANAGE_PERMISSION,
    );

    if (!authResult.authorized) {
      return Response.json(
        { error: authResult.error },
        { status: authResult.status },
      );
    }
    const auth = await requireRole(request, [
      "owner",
      "admin",
      "hr",
    ]);

    if (!auth.authorized) {
      return NextResponse.json(
        { error: auth.error },
        { status: auth.status },
      );
    }

    const body = await request.json();

    const name = body.name?.trim();

    if (!name) {
      return Response.json(
        { error: "Leave type name is required" },
        { status: 400 },
      );
    }

    const daysPerYear = Number(body.daysPerYear ?? 0);

    if (
      !Number.isInteger(daysPerYear) ||
      daysPerYear < 0
    ) {
      return Response.json(
        { error: "daysPerYear must be a non-negative integer" },
        { status: 400 },
      );
    }

    const [existing] = await db
      .select()
      .from(leaveTypes)
      .where(
        and(
          eq(
            leaveTypes.tenantId,
            authResult.tenant.id,
          ),
          eq(leaveTypes.name, name),
        ),
      )
      .limit(1);

    if (existing) {
      return Response.json(
        { error: "Leave type already exists" },
        { status: 409 },
      );
    }

    const carryForwardLimit =
      body.carryForwardLimit === undefined || body.carryForwardLimit === null
        ? null
        : Number(body.carryForwardLimit);

    const maxConsecutiveDays =
      body.maxConsecutiveDays === undefined || body.maxConsecutiveDays === null
        ? null
        : Number(body.maxConsecutiveDays);

    const minNoticeDays =
      body.minNoticeDays === undefined || body.minNoticeDays === null
        ? null
        : Number(body.minNoticeDays);

    const [created] = await db
      .insert(leaveTypes)
      .values({
        tenantId: authResult.tenant.id,
        name,
        description: body.description?.trim() || null,
        daysPerYear,
        isActive: "true",
        carryForwardLimit,
        maxConsecutiveDays,
        minNoticeDays,
        encashmentAllowed: Boolean(body.encashmentAllowed),
        isPaid: body.isPaid === undefined ? true : Boolean(body.isPaid),
        rulesText: body.rulesText?.trim() || null,
      })
      .returning();

    return Response.json(created, { status: 201 });
  } catch (error) {
    console.error("Leave type POST error:", error);

    return Response.json(
      { error: "Failed to create leave type" },
      { status: 500 },
    );
  }
}