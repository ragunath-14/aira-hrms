import { NextResponse } from "next/server";

import { db } from "@/db";
import { permissions, rolePermissions, roles } from "@/db/schema/rbac";
import { requireRole } from "@/lib/authorization";

export async function GET(request: Request) {
  try {
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

    const allRoles = await db.select().from(roles);
    const allPermissions = await db.select().from(permissions);
    const links = await db.select().from(rolePermissions);

    const permissionsByRole = allRoles.map((role) => ({
      ...role,
      permissions: links
        .filter((link) => link.roleId === role.id)
        .map(
          (link) =>
            allPermissions.find((p) => p.id === link.permissionId)!.key,
        ),
    }));

    return NextResponse.json({
      roles: permissionsByRole,
      permissions: allPermissions,
    });
  } catch (error) {
    console.error("GET roles error:", error);

    return NextResponse.json(
      { error: "Failed to fetch roles" },
      { status: 500 },
    );
  }
}
