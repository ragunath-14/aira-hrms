import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/db";
import { attendance, attendancePhotos } from "@/db/schema/attendance";
import { employees } from "@/db/schema/employees";
import { getCurrentTenant } from "@/lib/auth/authorization";
import { isUuid } from "@/lib/validation/ids";

const HR_ROLES = ["owner", "admin", "hr"];

// The selfie taken at a punch (?kind=in or out). Owner, admin and HR can see
// anyone's; an employee only their own. Everyone else gets "not found".
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await getCurrentTenant(request);

    if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    if (!isUuid(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

    const kind = new URL(request.url).searchParams.get("kind") === "out" ? "out" : "in";

    const [record] = await db
      .select({ employeeId: attendance.employeeId })
      .from(attendance)
      .where(and(eq(attendance.id, id), eq(attendance.tenantId, context.tenant.id)))
      .limit(1);

    if (!record) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (!HR_ROLES.includes(context.membership.role)) {
      const [owner] = await db
        .select({ userId: employees.userId })
        .from(employees)
        .where(eq(employees.id, record.employeeId))
        .limit(1);

      if (owner?.userId !== context.user.id) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
    }

    const [photo] = await db
      .select({ mimeType: attendancePhotos.mimeType, data: attendancePhotos.data })
      .from(attendancePhotos)
      .where(
        and(
          eq(attendancePhotos.attendanceId, id),
          eq(attendancePhotos.kind, kind),
          eq(attendancePhotos.tenantId, context.tenant.id),
        ),
      )
      .limit(1);

    if (!photo) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return new NextResponse(new Uint8Array(photo.data), {
      headers: {
        "Content-Type": photo.mimeType,
        "Content-Length": String(photo.data.length),
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("GET attendance photo error:", error);

    return NextResponse.json({ error: "Failed to load the photo" }, { status: 500 });
  }
}
