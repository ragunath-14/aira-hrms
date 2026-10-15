import { isUuid } from "@/lib/validation/ids";
import { eq, and } from "drizzle-orm";
import {
  getCurrentTenant,
  requireRole,
} from "@/lib/auth/authorization";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { leaveRequests, leaveTypes } from "@/db/schema/leaves";
import { logAudit } from "@/lib/domain/audit";
import { requirePermission } from "@/lib/auth/authorization";
import { type Permission } from "@/lib/auth/permissions";

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
      isPaid?: boolean;
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

    if (body.isPaid !== undefined) {
      updateData.isPaid = Boolean(body.isPaid);
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

// A leave type that has requests attached cannot be deleted: that would wipe
// employees' leave history. HR has to keep it (or clear the requests first).
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireRole(request, ["owner", "admin", "hr"]);

    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { id } = await params;
    if (!isUuid(id)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const [inUse] = await db
      .select({ id: leaveRequests.id })
      .from(leaveRequests)
      .where(and(eq(leaveRequests.leaveTypeId, id), eq(leaveRequests.tenantId, auth.tenant.id)))
      .limit(1);

    if (inUse) {
      return NextResponse.json(
        { error: "This leave type already has leave requests, so it can't be deleted." },
        { status: 409 },
      );
    }

    const [deleted] = await db
      .delete(leaveTypes)
      .where(and(eq(leaveTypes.id, id), eq(leaveTypes.tenantId, auth.tenant.id)))
      .returning({ id: leaveTypes.id });

    if (!deleted) {
      return NextResponse.json({ error: "Leave type not found" }, { status: 404 });
    }

    await logAudit({
      tenantId: auth.tenant.id,
      userId: auth.user.id,
      action: "leave_type_deleted",
      entity: "leave_type",
      entityId: id,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Leave type DELETE error:", error);
    return NextResponse.json({ error: "Failed to delete leave type" }, { status: 500 });
  }
}
