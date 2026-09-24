import { isUuid } from "@/lib/ids";
import { eq, and } from "drizzle-orm";
import {
  getCurrentTenant,
  requireRole,
} from "@/lib/authorization";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { leaveTypes } from "@/db/schema/leaves";
import { requirePermission } from "@/lib/authorization";
import { type Permission } from "@/lib/permissions";

const LEAVE_MANAGE_PERMISSION =
  "leave:manage" as Permission;

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
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

    const { id } = await params;
    if (!isUuid(id)) {
      return Response.json({ error: "Invalid id" }, { status: 400 });
    }
    const body = await request.json();

    const updateData: {
      name?: string;
      description?: string | null;
      daysPerYear?: number;
      isActive?: string;
      carryForwardLimit?: number | null;
      maxConsecutiveDays?: number | null;
      minNoticeDays?: number | null;
      encashmentAllowed?: boolean;
      rulesText?: string | null;
      updatedAt: Date;
    } = {
      updatedAt: new Date(),
    };

    if (body.name !== undefined) {
      const name = body.name.trim();

      if (!name) {
        return Response.json(
          { error: "Leave type name cannot be empty" },
          { status: 400 },
        );
      }

      updateData.name = name;
    }

    if (body.description !== undefined) {
      updateData.description =
        body.description?.trim() || null;
    }

    if (body.daysPerYear !== undefined) {
      const daysPerYear = Number(body.daysPerYear);

      if (
        !Number.isInteger(daysPerYear) ||
        daysPerYear < 0
      ) {
        return Response.json(
          {
            error:
              "daysPerYear must be a non-negative integer",
          },
          { status: 400 },
        );
      }

      updateData.daysPerYear = daysPerYear;
    }

    if (body.isActive !== undefined) {
      updateData.isActive = body.isActive
        ? "true"
        : "false";
    }

    if (body.carryForwardLimit !== undefined) {
      updateData.carryForwardLimit =
        body.carryForwardLimit === null ? null : Number(body.carryForwardLimit);
    }

    if (body.maxConsecutiveDays !== undefined) {
      updateData.maxConsecutiveDays =
        body.maxConsecutiveDays === null ? null : Number(body.maxConsecutiveDays);
    }

    if (body.minNoticeDays !== undefined) {
      updateData.minNoticeDays =
        body.minNoticeDays === null ? null : Number(body.minNoticeDays);
    }

    if (body.encashmentAllowed !== undefined) {
      updateData.encashmentAllowed = Boolean(body.encashmentAllowed);
    }

    if (body.rulesText !== undefined) {
      updateData.rulesText = body.rulesText?.trim() || null;
    }

    if (updateData.name !== undefined) {
      const [existing] = await db
        .select()
        .from(leaveTypes)
        .where(
          and(
            eq(
              leaveTypes.tenantId,
              authResult.tenant.id,
            ),
            eq(leaveTypes.name, updateData.name),
          ),
        )
        .limit(1);

      if (existing && existing.id !== id) {
        return Response.json(
          { error: "Leave type already exists" },
          { status: 409 },
        );
      }
    }

    const [updated] = await db
      .update(leaveTypes)
      .set(updateData)
      .where(
        and(
          eq(leaveTypes.id, id),
          eq(
            leaveTypes.tenantId,
            authResult.tenant.id,
          ),
        ),
      )
      .returning();

    if (!updated) {
      return Response.json(
        { error: "Leave type not found" },
        { status: 404 },
      );
    }

    return Response.json(updated);
  } catch (error) {
    console.error("Leave type update error:", error);

    return Response.json(
      { error: "Failed to update leave type" },
      { status: 500 },
    );
  }
}